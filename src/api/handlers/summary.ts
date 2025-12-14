/**
 * GET /api/place/:geoUnitId/summary
 * Returns tax cards + totals + top jurisdictions + payroll breakdown
 */

import { sql, eq, and, desc } from 'drizzle-orm';
import { db, getCurrentMethodologyVersionId } from '../../db';
import {
  geoUnit,
  geoUnitJurisdiction,
  jurisdiction,
  taxInstrument,
  taxRateSnapshot,
  taxBurdenEstimate,
  sourceDoc,
} from '../../db/schema';
import type {
  PlaceSummaryResponse,
  JurisdictionSummary,
  TaxCardSummary,
  TaxBurdenSummary,
  DataType,
  SourceReference,
  PayrollBreakdown,
} from '../../types/api';
import type { GeoUnitIdParam, SummaryQueryInput } from '../../lib/validation';
import type { TaxType, PresenceMode, ProfileType } from '../../types/database';
import {
  computePayrollBreakdown,
  type PayrollSnapshotInput,
} from '../../lib/payroll-computation';

/**
 * Get current tax year (default to current calendar year)
 */
function getCurrentTaxYear(): number {
  return new Date().getFullYear();
}

/**
 * Build source reference from source doc
 */
function buildSourceReference(doc: {
  sourceDocId: string;
  url: string;
  title: string | null;
  retrievedAt: Date | null;
  publishedAt: string | null;
  isDemo: boolean;
}): SourceReference {
  return {
    sourceId: doc.sourceDocId,
    url: doc.url,
    title: doc.title,
    retrievedAt: doc.retrievedAt?.toISOString() ?? null,
    publishedAt: doc.publishedAt,
    isDemo: doc.isDemo,
  };
}

/**
 * Determine data type based on source and calculation method
 */
function determineDataType(isDemo: boolean, isCalculated: boolean): DataType {
  if (isCalculated) return 'estimate';
  return 'fact';
}

export async function summaryHandler(
  params: GeoUnitIdParam,
  query: SummaryQueryInput
): Promise<PlaceSummaryResponse> {
  const { geoUnitId } = params;
  const taxYear = query.year ?? getCurrentTaxYear();
  const presenceMode = (query.mode ?? 'live_work') as PresenceMode;

  // Extract payroll computation params
  const profileType = query.profile_type as ProfileType | undefined;
  const wagesAnnual = query.wages_annual;
  const contractorIncomeAnnual = query.contractor_income_annual;
  const showEmployerSide = query.show_employer_side ?? false;

  const methodologyVersionId = await getCurrentMethodologyVersionId();

  // 1. Get geo_unit details with geometry
  const geoUnitResult = await db.execute(sql`
    SELECT
      g.geo_unit_id,
      g.geo_unit_type,
      g.name,
      g.state_code,
      g.county_fips,
      sd.is_demo,
      ST_XMin(ST_Envelope(g.geom)) as min_lng,
      ST_YMin(ST_Envelope(g.geom)) as min_lat,
      ST_XMax(ST_Envelope(g.geom)) as max_lng,
      ST_YMax(ST_Envelope(g.geom)) as max_lat,
      ST_X(g.centroid) as centroid_lng,
      ST_Y(g.centroid) as centroid_lat
    FROM geo_unit g
    JOIN source_doc sd ON sd.source_doc_id = g.source_doc_id
    WHERE g.geo_unit_id = ${geoUnitId}
  `);

  if (geoUnitResult.rows.length === 0) {
    throw new Error(`GeoUnit not found: ${geoUnitId}`);
  }

  const geo = geoUnitResult.rows[0] as {
    geo_unit_id: string;
    geo_unit_type: string;
    name: string;
    state_code: string;
    county_fips: string | null;
    is_demo: boolean;
    min_lng: number;
    min_lat: number;
    max_lng: number;
    max_lat: number;
    centroid_lng: number;
    centroid_lat: number;
  };

  // 2. Get jurisdictions for this geo_unit
  const jurisdictionsResult = await db
    .select({
      jurisdictionId: jurisdiction.jurisdictionId,
      jurisdictionType: jurisdiction.jurisdictionType,
      name: jurisdiction.name,
      coverageRatio: geoUnitJurisdiction.coverageRatio,
    })
    .from(geoUnitJurisdiction)
    .innerJoin(
      jurisdiction,
      eq(geoUnitJurisdiction.jurisdictionId, jurisdiction.jurisdictionId)
    )
    .where(
      and(
        eq(geoUnitJurisdiction.geoUnitId, geoUnitId),
        eq(geoUnitJurisdiction.methodologyVersionId, methodologyVersionId)
      )
    )
    .orderBy(desc(geoUnitJurisdiction.coverageRatio));

  const jurisdictions: JurisdictionSummary[] = jurisdictionsResult.map((j) => ({
    jurisdictionId: j.jurisdictionId,
    jurisdictionType: j.jurisdictionType,
    name: j.name,
    coverageRatio: Number(j.coverageRatio),
  }));

  // 3. Get tax cards (current rates by tax type)
  const taxCardsResult = await db.execute(sql`
    WITH applicable_instruments AS (
      SELECT
        ti.tax_instrument_id,
        ti.jurisdiction_id,
        ti.tax_type,
        ti.name AS instrument_name,
        guj.coverage_ratio
      FROM geo_unit_jurisdiction guj
      JOIN tax_instrument ti ON ti.jurisdiction_id = guj.jurisdiction_id
      WHERE guj.geo_unit_id = ${geoUnitId}
        AND guj.methodology_version_id = ${methodologyVersionId}
        AND guj.coverage_ratio > 0
        AND ti.is_active = true
    ),
    latest_rates AS (
      SELECT DISTINCT ON (ai.tax_type)
        ai.tax_type,
        ai.instrument_name,
        ai.jurisdiction_id,
        trs.rate_value,
        trs.rate_unit,
        trs.source_doc_id,
        COUNT(*) OVER (PARTITION BY ai.tax_type) as jurisdiction_count,
        SUM(COALESCE(trs.rate_value, 0) * ai.coverage_ratio) OVER (PARTITION BY ai.tax_type) as weighted_total
      FROM applicable_instruments ai
      LEFT JOIN LATERAL (
        SELECT trs.*
        FROM tax_rate_snapshot trs
        WHERE trs.tax_instrument_id = ai.tax_instrument_id
          AND trs.methodology_version_id = ${methodologyVersionId}
          AND (trs.tax_year = ${taxYear} OR trs.effective_date <= CURRENT_DATE)
          AND (trs.end_date IS NULL OR trs.end_date > CURRENT_DATE)
        ORDER BY trs.effective_date DESC
        LIMIT 1
      ) trs ON true
      ORDER BY ai.tax_type, ai.coverage_ratio DESC
    )
    SELECT
      lr.tax_type,
      lr.weighted_total as total_rate,
      lr.rate_unit,
      lr.jurisdiction_count,
      sd.source_doc_id,
      sd.url,
      sd.title,
      sd.retrieved_at,
      sd.published_at,
      sd.is_demo
    FROM latest_rates lr
    LEFT JOIN source_doc sd ON sd.source_doc_id = lr.source_doc_id
  `);

  const taxCards: TaxCardSummary[] = (taxCardsResult.rows as Array<{
    tax_type: TaxType;
    total_rate: string | null;
    rate_unit: string;
    jurisdiction_count: string;
    source_doc_id: string;
    url: string;
    title: string | null;
    retrieved_at: Date | null;
    published_at: string | null;
    is_demo: boolean;
  }>).map((row) => ({
    taxType: row.tax_type,
    totalRate: row.total_rate ? Number(row.total_rate) : null,
    rateUnit: row.rate_unit || 'percent',
    dataType: determineDataType(row.is_demo, true),
    jurisdictionCount: Number(row.jurisdiction_count),
    source: buildSourceReference({
      sourceDocId: row.source_doc_id,
      url: row.url,
      title: row.title,
      retrievedAt: row.retrieved_at,
      publishedAt: row.published_at,
      isDemo: row.is_demo,
    }),
    note: null,
  }));

  // 4. Get burden estimate if available
  let burdenEstimate: TaxBurdenSummary | null = null;

  const burdenResult = await db
    .select({
      taxYear: taxBurdenEstimate.taxYear,
      presenceMode: taxBurdenEstimate.presenceMode,
      currencyCode: taxBurdenEstimate.currencyCode,
      totalAmount: taxBurdenEstimate.totalAmount,
      components: taxBurdenEstimate.components,
      sourceDocId: sourceDoc.sourceDocId,
      url: sourceDoc.url,
      title: sourceDoc.title,
      retrievedAt: sourceDoc.retrievedAt,
      publishedAt: sourceDoc.publishedAt,
      isDemo: sourceDoc.isDemo,
    })
    .from(taxBurdenEstimate)
    .innerJoin(sourceDoc, eq(taxBurdenEstimate.sourceDocId, sourceDoc.sourceDocId))
    .where(
      and(
        eq(taxBurdenEstimate.geoUnitId, geoUnitId),
        eq(taxBurdenEstimate.methodologyVersionId, methodologyVersionId),
        eq(taxBurdenEstimate.taxYear, taxYear),
        eq(taxBurdenEstimate.presenceMode, presenceMode)
      )
    )
    .limit(1);

  if (burdenResult.length > 0) {
    const burden = burdenResult[0];
    const components = burden.components as Record<string, { amount: number; percentage: number }>;

    burdenEstimate = {
      taxYear: burden.taxYear,
      presenceMode: burden.presenceMode,
      currencyCode: burden.currencyCode,
      totalAmount: Number(burden.totalAmount),
      components: Object.entries(components).map(([taxType, data]) => ({
        taxType: taxType as TaxType,
        amount: data.amount,
        percentage: data.percentage,
      })),
      // Payroll breakdown computed below if wages provided
      payrollBreakdown: null,
      dataType: 'estimate',
      source: buildSourceReference({
        sourceDocId: burden.sourceDocId,
        url: burden.url,
        title: burden.title,
        retrievedAt: burden.retrievedAt,
        publishedAt: burden.publishedAt?.toString() ?? null,
        isDemo: burden.isDemo,
      }),
    };
  }

  // 5. Compute payroll breakdown if wages and profile type provided
  let payrollBreakdown: PayrollBreakdown | null = null;

  if (profileType && wagesAnnual !== undefined && wagesAnnual > 0) {
    // Query payroll tax snapshots for the geo_unit's jurisdictions
    const payrollSnapshotsResult = await db.execute(sql`
      SELECT
        pts.payroll_tax_snapshot_id,
        pts.tax_instrument_id,
        ti.name AS instrument_name,
        j.name AS jurisdiction_name,
        j.jurisdiction_type,
        pts.payroll_category,
        pts.payer_type,
        pts.tax_year,
        pts.employee_rate,
        pts.employer_rate,
        pts.self_employed_rate,
        pts.wage_base_limit,
        pts.wage_floor,
        pts.thresholds,
        pts.metadata,
        sd.source_doc_id,
        sd.url AS source_url,
        sd.title AS source_title,
        sd.retrieved_at AS source_retrieved_at,
        sd.published_at AS source_published_at,
        sd.is_demo
      FROM payroll_tax_snapshot pts
      JOIN tax_instrument ti ON ti.tax_instrument_id = pts.tax_instrument_id
      JOIN jurisdiction j ON j.jurisdiction_id = ti.jurisdiction_id
      JOIN source_doc sd ON sd.source_doc_id = pts.source_doc_id
      WHERE pts.tax_year = ${taxYear}
        AND pts.methodology_version_id = ${methodologyVersionId}
        AND (
          -- Include federal payroll taxes (apply to all)
          j.jurisdiction_type = 'federal'
          -- Include state payroll taxes for geo_unit's state
          OR (j.jurisdiction_type = 'state' AND j.state_code = ${geo.state_code})
          -- Include local payroll taxes for geo_unit's jurisdictions
          OR j.jurisdiction_id IN (
            SELECT jurisdiction_id FROM geo_unit_jurisdiction
            WHERE geo_unit_id = ${geoUnitId}
              AND methodology_version_id = ${methodologyVersionId}
          )
        )
      ORDER BY j.jurisdiction_type, pts.payroll_category
    `);

    // Transform to PayrollSnapshotInput
    const snapshots: PayrollSnapshotInput[] = (payrollSnapshotsResult.rows as Array<{
      payroll_tax_snapshot_id: string;
      tax_instrument_id: string;
      instrument_name: string;
      jurisdiction_name: string;
      jurisdiction_type: string;
      payroll_category: string;
      payer_type: string;
      tax_year: number;
      employee_rate: string | null;
      employer_rate: string | null;
      self_employed_rate: string | null;
      wage_base_limit: string | null;
      wage_floor: string | null;
      thresholds: Record<string, number | undefined>;
      metadata: Record<string, unknown>;
      source_doc_id: string;
      source_url: string;
      source_title: string | null;
      source_retrieved_at: Date | null;
      source_published_at: string | null;
      is_demo: boolean;
    }>).map((row) => ({
      payrollTaxSnapshotId: row.payroll_tax_snapshot_id,
      taxInstrumentId: row.tax_instrument_id,
      instrumentName: row.instrument_name,
      jurisdictionName: row.jurisdiction_name,
      jurisdictionType: row.jurisdiction_type,
      payrollCategory: row.payroll_category as PayrollSnapshotInput['payrollCategory'],
      payerType: row.payer_type as PayrollSnapshotInput['payerType'],
      taxYear: row.tax_year,
      employeeRate: row.employee_rate ? Number(row.employee_rate) : null,
      employerRate: row.employer_rate ? Number(row.employer_rate) : null,
      selfEmployedRate: row.self_employed_rate ? Number(row.self_employed_rate) : null,
      wageBaseLimit: row.wage_base_limit ? Number(row.wage_base_limit) : null,
      wageFloor: row.wage_floor ? Number(row.wage_floor) : null,
      thresholds: row.thresholds,
      metadata: row.metadata as PayrollSnapshotInput['metadata'],
      sourceDocId: row.source_doc_id,
      sourceUrl: row.source_url,
      sourceTitle: row.source_title,
      sourceRetrievedAt: row.source_retrieved_at,
      sourcePublishedAt: row.source_published_at,
      isDemo: row.is_demo,
    }));

    // Compute payroll breakdown
    const computationResult = computePayrollBreakdown({
      wagesAnnual,
      taxYear,
      profileType,
      showEmployerSide,
      contractorIncomeAnnual,
      snapshots,
    });

    // Transform to API response format
    if (computationResult.enabled) {
      payrollBreakdown = {
        employeePaid: {
          items: computationResult.employeePaid.map((item) => ({
            instrumentId: item.instrumentId,
            instrumentName: item.instrumentName,
            category: item.category,
            payer: item.payer,
            amount: item.amount,
            rate: item.rate,
            wageBase: item.wageBase,
            threshold: item.threshold,
            dataType: item.dataType,
            source: item.source,
            label: item.label,
            note: item.note,
            microcopy: item.microcopy,
          })),
          total: computationResult.totals.employeePaidTotal,
        },
        employerPaid: {
          items: computationResult.employerPaid.map((item) => ({
            instrumentId: item.instrumentId,
            instrumentName: item.instrumentName,
            category: item.category,
            payer: item.payer,
            amount: item.amount,
            rate: item.rate,
            wageBase: item.wageBase,
            threshold: item.threshold,
            dataType: item.dataType,
            source: item.source,
            label: item.label,
            note: item.note,
            microcopy: item.microcopy,
          })),
          total: computationResult.totals.employerPaidTotal,
        },
        programFees: {
          items: computationResult.programFees.map((item) => ({
            instrumentId: item.instrumentId,
            instrumentName: item.instrumentName,
            category: item.category,
            payer: item.payer,
            amount: item.amount,
            rate: item.rate,
            wageBase: item.wageBase,
            threshold: item.threshold,
            dataType: item.dataType,
            source: item.source,
            label: item.label,
            note: item.note,
            microcopy: item.microcopy,
          })),
          total: computationResult.totals.programFeesTotal,
        },
        totalEmployeePaid: computationResult.totals.employeePaidTotal,
        totalEmployerPaid: computationResult.totals.employerPaidTotal,
        totalPayroll: computationResult.totals.combinedTotal,
        assumptions: {
          profileType: computationResult.profileType,
          wagesAnnual: computationResult.inputs.wagesAnnual,
          showEmployerSide: computationResult.inputs.showEmployerSide,
        },
        dataType: computationResult.dataType,
        notes: computationResult.notes,
      };

      // Attach to burden estimate if it exists
      if (burdenEstimate) {
        burdenEstimate.payrollBreakdown = payrollBreakdown;
      }
    }
  }

  // Build response
  return {
    geoUnitId,
    name: geo.name,
    displayName: `${geo.name}, ${geo.state_code}`,
    geoUnitType: geo.geo_unit_type as PlaceSummaryResponse['geoUnitType'],
    stateCode: geo.state_code,
    confidence: 'high', // Place was found by ID, so confidence is high
    isDemo: geo.is_demo,
    taxYear,
    presenceMode,
    jurisdictions,
    taxCards,
    burdenEstimate,
    bbox: [geo.min_lng, geo.min_lat, geo.max_lng, geo.max_lat],
    centroid: {
      type: 'Point',
      coordinates: [geo.centroid_lng, geo.centroid_lat],
    },
  };
}
