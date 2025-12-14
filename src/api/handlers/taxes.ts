/**
 * GET /api/place/:geoUnitId/taxes
 * Returns time series tax data and sources
 */

import { sql, eq, and, gte, lte, desc, asc } from 'drizzle-orm';
import { db, getCurrentMethodologyVersionId } from '../../db';
import {
  geoUnit,
  geoUnitJurisdiction,
  jurisdiction,
  taxInstrument,
  taxRateSnapshot,
  propertyTaxContextSnapshot,
  sourceDoc,
  methodologyVersion,
} from '../../db/schema';
import type {
  TaxesResponse,
  TaxCategoryDetail,
  JurisdictionTaxDetail,
  TaxRateDataPoint,
  PropertyTaxContext,
  SourceReference,
  DataType,
} from '../../types/api';
import type { GeoUnitIdParam, TaxesQueryInput } from '../../lib/validation';
import type { TaxType } from '../../types/database';

// Tax type display names
const TAX_TYPE_DISPLAY_NAMES: Record<TaxType, string> = {
  property: 'Property Tax',
  sales: 'Sales Tax',
  income: 'Income Tax',
  payroll: 'Payroll Tax',
  corporate: 'Corporate Tax',
  excise: 'Excise Tax',
  lodging: 'Lodging Tax',
  utility: 'Utility Tax',
  other: 'Other Taxes',
};

/**
 * Calculate change percentage and direction
 */
function calculateChange(
  timeSeries: { year: number; totalRate: number }[]
): { changePercent: number | null; changeDirection: 'up' | 'down' | 'stable' | null } {
  if (timeSeries.length < 2) {
    return { changePercent: null, changeDirection: null };
  }

  const sorted = [...timeSeries].sort((a, b) => a.year - b.year);
  const first = sorted[0].totalRate;
  const last = sorted[sorted.length - 1].totalRate;

  if (first === 0) {
    return { changePercent: null, changeDirection: null };
  }

  const changePercent = ((last - first) / first) * 100;

  let changeDirection: 'up' | 'down' | 'stable';
  if (Math.abs(changePercent) < 0.01) {
    changeDirection = 'stable';
  } else if (changePercent > 0) {
    changeDirection = 'up';
  } else {
    changeDirection = 'down';
  }

  return { changePercent: Math.round(changePercent * 100) / 100, changeDirection };
}

export async function taxesHandler(
  params: GeoUnitIdParam,
  query: TaxesQueryInput
): Promise<TaxesResponse> {
  const { geoUnitId } = params;
  const currentYear = new Date().getFullYear();
  const fromYear = query.from ?? currentYear - 7;
  const toYear = query.to ?? currentYear;
  const taxTypeFilter = query.type;

  const methodologyVersionId = await getCurrentMethodologyVersionId();

  // Get methodology version name
  const mvResult = await db
    .select({ version: methodologyVersion.version })
    .from(methodologyVersion)
    .where(eq(methodologyVersion.methodologyVersionId, methodologyVersionId))
    .limit(1);

  const methodologyVersionName = mvResult[0]?.version ?? 'unknown';

  // Get geo_unit info
  const geoResult = await db
    .select({
      name: geoUnit.name,
      isDemo: sourceDoc.isDemo,
    })
    .from(geoUnit)
    .innerJoin(sourceDoc, eq(geoUnit.sourceDocId, sourceDoc.sourceDocId))
    .where(eq(geoUnit.geoUnitId, geoUnitId))
    .limit(1);

  if (geoResult.length === 0) {
    throw new Error(`GeoUnit not found: ${geoUnitId}`);
  }

  const { name, isDemo } = geoResult[0];

  // Build tax type filter condition
  const taxTypeCondition = taxTypeFilter
    ? sql`AND ti.tax_type = ${taxTypeFilter}`
    : sql``;

  // Get all applicable tax instruments with their rates over time
  const instrumentsResult = await db.execute(sql`
    WITH applicable_instruments AS (
      SELECT
        ti.tax_instrument_id,
        ti.jurisdiction_id,
        ti.tax_type,
        ti.name AS instrument_name,
        ti.description,
        guj.coverage_ratio
      FROM geo_unit_jurisdiction guj
      JOIN tax_instrument ti ON ti.jurisdiction_id = guj.jurisdiction_id
      WHERE guj.geo_unit_id = ${geoUnitId}
        AND guj.methodology_version_id = ${methodologyVersionId}
        AND guj.coverage_ratio > 0
        AND ti.is_active = true
        ${taxTypeCondition}
    )
    SELECT
      ai.tax_instrument_id,
      ai.tax_type,
      ai.instrument_name,
      ai.description,
      ai.coverage_ratio,
      j.jurisdiction_id,
      j.jurisdiction_type,
      j.name AS jurisdiction_name,
      trs.tax_rate_snapshot_id,
      trs.effective_date,
      trs.end_date,
      trs.tax_year,
      trs.rate_value,
      trs.rate_unit,
      trs.rate_brackets,
      sd.source_doc_id,
      sd.url,
      sd.title,
      sd.retrieved_at,
      sd.published_at,
      sd.is_demo
    FROM applicable_instruments ai
    JOIN jurisdiction j ON j.jurisdiction_id = ai.jurisdiction_id
    LEFT JOIN tax_rate_snapshot trs ON trs.tax_instrument_id = ai.tax_instrument_id
      AND trs.methodology_version_id = ${methodologyVersionId}
      AND (trs.tax_year BETWEEN ${fromYear} AND ${toYear}
           OR (trs.tax_year IS NULL AND EXTRACT(YEAR FROM trs.effective_date) BETWEEN ${fromYear} AND ${toYear}))
    LEFT JOIN source_doc sd ON sd.source_doc_id = trs.source_doc_id
    ORDER BY ai.tax_type, j.jurisdiction_type, j.name, trs.tax_year DESC NULLS LAST, trs.effective_date DESC
  `);

  // Get property tax context if property tax is included
  let propertyContextData: PropertyTaxContext[] = [];

  if (!taxTypeFilter || taxTypeFilter === 'property') {
    const propertyResult = await db.execute(sql`
      SELECT
        ptc.tax_year,
        ptc.levy_amount,
        ptc.taxable_value_amount,
        ptc.median_bill_amount,
        ptc.bill_p25_amount,
        ptc.bill_p75_amount,
        ptc.parcel_count,
        ptc.household_count,
        sd.source_doc_id,
        sd.url,
        sd.title,
        sd.retrieved_at,
        sd.published_at,
        sd.is_demo
      FROM property_tax_context_snapshot ptc
      JOIN source_doc sd ON sd.source_doc_id = ptc.source_doc_id
      WHERE ptc.geo_unit_id = ${geoUnitId}
        AND ptc.methodology_version_id = ${methodologyVersionId}
        AND ptc.tax_year BETWEEN ${fromYear} AND ${toYear}
      ORDER BY ptc.tax_year DESC
    `);

    propertyContextData = (propertyResult.rows as Array<{
      tax_year: number;
      levy_amount: string | null;
      taxable_value_amount: string | null;
      median_bill_amount: string | null;
      bill_p25_amount: string | null;
      bill_p75_amount: string | null;
      parcel_count: number | null;
      household_count: number | null;
      source_doc_id: string;
      url: string;
      title: string | null;
      retrieved_at: Date | null;
      published_at: string | null;
      is_demo: boolean;
    }>).map((row) => ({
      taxYear: row.tax_year,
      levyAmount: row.levy_amount ? Number(row.levy_amount) : null,
      taxableValueAmount: row.taxable_value_amount ? Number(row.taxable_value_amount) : null,
      medianBillAmount: row.median_bill_amount ? Number(row.median_bill_amount) : null,
      billP25Amount: row.bill_p25_amount ? Number(row.bill_p25_amount) : null,
      billP75Amount: row.bill_p75_amount ? Number(row.bill_p75_amount) : null,
      parcelCount: row.parcel_count,
      householdCount: row.household_count,
      dataType: 'fact' as DataType,
      source: {
        sourceId: row.source_doc_id,
        url: row.url,
        title: row.title,
        retrievedAt: row.retrieved_at?.toISOString() ?? null,
        publishedAt: row.published_at,
        isDemo: row.is_demo,
      },
    }));
  }

  // Group results by tax type, then by jurisdiction
  const categoriesMap = new Map<TaxType, Map<string, JurisdictionTaxDetail>>();

  for (const row of instrumentsResult.rows as Array<{
    tax_instrument_id: string;
    tax_type: TaxType;
    instrument_name: string;
    description: string | null;
    coverage_ratio: string;
    jurisdiction_id: string;
    jurisdiction_type: string;
    jurisdiction_name: string;
    tax_rate_snapshot_id: string | null;
    effective_date: string | null;
    end_date: string | null;
    tax_year: number | null;
    rate_value: string | null;
    rate_unit: string | null;
    rate_brackets: unknown;
    source_doc_id: string | null;
    url: string | null;
    title: string | null;
    retrieved_at: Date | null;
    published_at: string | null;
    is_demo: boolean | null;
  }>) {
    const taxType = row.tax_type;

    if (!categoriesMap.has(taxType)) {
      categoriesMap.set(taxType, new Map());
    }

    const jurisdictionsMap = categoriesMap.get(taxType)!;
    const jurisdictionKey = `${row.jurisdiction_id}-${row.tax_instrument_id}`;

    if (!jurisdictionsMap.has(jurisdictionKey)) {
      jurisdictionsMap.set(jurisdictionKey, {
        jurisdictionId: row.jurisdiction_id,
        jurisdictionType: row.jurisdiction_type as JurisdictionTaxDetail['jurisdictionType'],
        jurisdictionName: row.jurisdiction_name,
        instrumentId: row.tax_instrument_id,
        instrumentName: row.instrument_name,
        coverageRatio: Number(row.coverage_ratio),
        currentRate: null,
        rateUnit: 'percent',
        dataType: 'fact',
        source: {
          sourceId: '',
          url: '',
          title: null,
          retrievedAt: null,
          publishedAt: null,
          isDemo: false,
        },
        note: row.description,
        timeSeries: [],
      });
    }

    const jurisdictionDetail = jurisdictionsMap.get(jurisdictionKey)!;

    // Add time series data point
    if (row.tax_rate_snapshot_id && row.effective_date) {
      const dataPoint: TaxRateDataPoint = {
        year: row.tax_year ?? new Date(row.effective_date).getFullYear(),
        effectiveDate: row.effective_date,
        rateValue: row.rate_value ? Number(row.rate_value) : null,
        rateBrackets: row.rate_brackets as TaxRateDataPoint['rateBrackets'],
        rateUnit: row.rate_unit ?? 'percent',
        dataType: row.is_demo ? 'estimate' : 'fact',
        source: {
          sourceId: row.source_doc_id ?? '',
          url: row.url ?? '',
          title: row.title,
          retrievedAt: row.retrieved_at?.toISOString() ?? null,
          publishedAt: row.published_at,
          isDemo: row.is_demo ?? false,
        },
      };

      jurisdictionDetail.timeSeries.push(dataPoint);

      // Update current rate (most recent)
      if (
        jurisdictionDetail.currentRate === null ||
        dataPoint.year > (jurisdictionDetail.timeSeries[0]?.year ?? 0)
      ) {
        jurisdictionDetail.currentRate = dataPoint.rateValue;
        jurisdictionDetail.rateUnit = dataPoint.rateUnit;
        jurisdictionDetail.dataType = dataPoint.dataType;
        jurisdictionDetail.source = dataPoint.source;
      }
    }
  }

  // Build categories array
  const categories: TaxCategoryDetail[] = [];

  for (const [taxType, jurisdictionsMap] of categoriesMap) {
    const jurisdictions = Array.from(jurisdictionsMap.values());

    // Sort time series by year
    for (const j of jurisdictions) {
      j.timeSeries.sort((a, b) => a.year - b.year);
    }

    // Calculate combined trend data
    const yearlyTotals = new Map<number, number>();

    for (const j of jurisdictions) {
      for (const dp of j.timeSeries) {
        if (dp.rateValue !== null) {
          const current = yearlyTotals.get(dp.year) ?? 0;
          yearlyTotals.set(dp.year, current + dp.rateValue * j.coverageRatio);
        }
      }
    }

    const trendData = Array.from(yearlyTotals.entries())
      .map(([year, totalRate]) => ({ year, totalRate }))
      .sort((a, b) => a.year - b.year);

    // Calculate total current rate
    const totalRate = jurisdictions.reduce(
      (sum, j) => sum + (j.currentRate ?? 0) * j.coverageRatio,
      0
    );

    const { changePercent, changeDirection } = calculateChange(trendData);

    categories.push({
      taxType,
      displayName: TAX_TYPE_DISPLAY_NAMES[taxType],
      totalRate: Math.round(totalRate * 10000) / 10000,
      rateUnit: jurisdictions[0]?.rateUnit ?? 'percent',
      dataType: 'estimate', // Combined rate is always an estimate
      jurisdictions,
      propertyContext: taxType === 'property' ? propertyContextData : null,
      trendData,
      changePercent,
      changeDirection,
    });
  }

  // Sort categories by tax type importance
  const typeOrder: TaxType[] = ['property', 'sales', 'income', 'payroll', 'corporate', 'excise', 'lodging', 'utility', 'other'];
  categories.sort((a, b) => typeOrder.indexOf(a.taxType) - typeOrder.indexOf(b.taxType));

  return {
    geoUnitId,
    name,
    taxYear: toYear,
    presenceMode: 'live_work',
    isDemo,
    categories,
    methodologyVersion: methodologyVersionName,
  };
}
