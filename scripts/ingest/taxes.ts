/**
 * Pipeline D) Taxes
 *
 * MVP loads pilot stub inputs:
 * - Property tax context snapshots (last ~10 years)
 * - Sales tax rate snapshots (time series)
 * - State income tax brackets (static config)
 */

import { createPool, withClient, withTransaction } from './lib/db.js';
import { fileExists } from './lib/files.js';
import { log } from './lib/logger.js';
import { ensureMethodologyVersion } from './lib/methodology.js';
import { getPilotConfig } from './lib/pilots.js';
import { repoFileUrl } from './lib/urls.js';
import { readCsvRecords } from './lib/csv.js';
import { readJsonFile, upsertSourceDocFromFile } from './lib/source-doc.js';
import {
  getGeoUnitId,
  getJurisdictionIdByExternalId,
  upsertTaxInstrument,
  type GeoUnitType,
  type TaxType,
} from './lib/upserts.js';

function toNullableNumber(v: string | undefined): number | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(v: string | undefined): number | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

type PropertyTaxCsv = {
  tax_year: string;
  geo_unit_type: GeoUnitType;
  geo_unit_geoid: string;
  jurisdiction_external_id: string;
  instrument_name: string;
  levy_amount?: string;
  taxable_value_amount?: string;
  tax_capacity_amount?: string;
  median_bill_amount?: string;
  bill_p25_amount?: string;
  bill_p75_amount?: string;
  parcel_count?: string;
  household_count?: string;
  effective_rate?: string;
  notes?: string;
};

type SalesTaxCsv = {
  jurisdiction_external_id: string;
  instrument_name: string;
  effective_date: string;
  end_date?: string;
  tax_year?: string;
  rate_value: string;
  rate_unit: string;
  notes?: string;
};

type IncomeTaxJson = {
  jurisdiction_external_id: string;
  instrument_name: string;
  effective_date: string;
  tax_year?: number;
  rate_unit: string;
  rate_brackets: unknown;
  notes?: string;
};

async function main(): Promise<void> {
  const pilot = getPilotConfig();
  log.info(`Starting taxes ingest`, { pilot: pilot.pilotId });

  const pool = createPool();
  await withClient(pool, async (client) => {
    await withTransaction(client, async () => {
      const factMethodologyVersionId = await ensureMethodologyVersion(client, {
        ...pilot.methodologies.fact,
        description: 'Pilot tax facts (stub inputs, replace with authoritative sources)',
      });
      const estimateMethodologyVersionId = await ensureMethodologyVersion(client, {
        ...pilot.methodologies.estimate,
        description: 'Pilot tax estimates (stub inputs, replace with modeled/allocated outputs)',
      });

      // -------------------------------------------------------------------
      // Property tax context snapshots (CSV)
      // -------------------------------------------------------------------
      if (!(await fileExists(pilot.paths.propertyTaxContextCsv))) {
        throw new Error(`Missing CSV: ${pilot.paths.propertyTaxContextCsv}`);
      }

      const { sourceDocId: propertySourceDocId } = await upsertSourceDocFromFile(
        client,
        pilot.paths.propertyTaxContextCsv,
        repoFileUrl(pilot.paths.propertyTaxContextCsv),
        {
          isDemo: true,
          title: `TaxAtlas pilot property tax context (${pilot.pilotId})`,
          mimeType: 'text/csv',
        }
      );

      const propertyRows = await readCsvRecords<PropertyTaxCsv>(pilot.paths.propertyTaxContextCsv);
      let propertyProcessed = 0;

      for (const row of propertyRows) {
        const taxYear = toNullableInt(row.tax_year);
        if (!taxYear) throw new Error(`Invalid tax_year: ${row.tax_year}`);

        const geoUnitId = await getGeoUnitId(client, row.geo_unit_type, row.geo_unit_geoid);
        if (!geoUnitId) {
          throw new Error(
            `Missing geo_unit for property_tax_context row: type=${row.geo_unit_type} geoid=${row.geo_unit_geoid}`
          );
        }

        const jurisdictionId = await getJurisdictionIdByExternalId(
          client,
          pilot.stateCode,
          row.jurisdiction_external_id
        );
        if (!jurisdictionId) {
          throw new Error(
            `Missing jurisdiction for property_tax_context row: external_id=${row.jurisdiction_external_id}`
          );
        }

        const taxInstrumentId = await upsertTaxInstrument(client, {
          jurisdictionId,
          taxType: 'property',
          name: row.instrument_name,
          metadata: { pilot: pilot.pilotId },
          sourceDocId: propertySourceDocId,
        });

        const metadata: Record<string, unknown> = { pilot: pilot.pilotId };
        const effectiveRate = toNullableNumber(row.effective_rate);
        if (effectiveRate !== null) metadata.effective_rate = effectiveRate;
        if (row.notes?.trim()) metadata.notes = row.notes.trim();

        await client.query(
          `
          INSERT INTO property_tax_context_snapshot (
            tax_instrument_id,
            geo_unit_id,
            methodology_version_id,
            tax_year,
            levy_amount,
            taxable_value_amount,
            tax_capacity_amount,
            median_bill_amount,
            bill_p25_amount,
            bill_p75_amount,
            parcel_count,
            household_count,
            metadata,
            source_doc_id
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::smallint,
            $5::numeric,
            $6::numeric,
            $7::numeric,
            $8::numeric,
            $9::numeric,
            $10::numeric,
            $11::int,
            $12::int,
            $13::jsonb,
            $14::uuid
          )
          ON CONFLICT (tax_instrument_id, geo_unit_id, methodology_version_id, tax_year)
          DO UPDATE SET
            levy_amount = EXCLUDED.levy_amount,
            taxable_value_amount = EXCLUDED.taxable_value_amount,
            tax_capacity_amount = EXCLUDED.tax_capacity_amount,
            median_bill_amount = EXCLUDED.median_bill_amount,
            bill_p25_amount = EXCLUDED.bill_p25_amount,
            bill_p75_amount = EXCLUDED.bill_p75_amount,
            parcel_count = EXCLUDED.parcel_count,
            household_count = EXCLUDED.household_count,
            metadata = EXCLUDED.metadata,
            source_doc_id = EXCLUDED.source_doc_id
          `,
          [
            taxInstrumentId,
            geoUnitId,
            estimateMethodologyVersionId,
            taxYear,
            toNullableNumber(row.levy_amount),
            toNullableNumber(row.taxable_value_amount),
            toNullableNumber(row.tax_capacity_amount),
            toNullableNumber(row.median_bill_amount),
            toNullableNumber(row.bill_p25_amount),
            toNullableNumber(row.bill_p75_amount),
            toNullableInt(row.parcel_count ?? undefined),
            toNullableInt(row.household_count ?? undefined),
            JSON.stringify(metadata),
            propertySourceDocId,
          ]
        );

        propertyProcessed += 1;
      }

      log.info(`Property tax context loaded`, { rows: propertyProcessed });

      // -------------------------------------------------------------------
      // Sales tax rate snapshots (CSV)
      // -------------------------------------------------------------------
      if (!(await fileExists(pilot.paths.salesTaxRatesCsv))) {
        throw new Error(`Missing CSV: ${pilot.paths.salesTaxRatesCsv}`);
      }

      const { sourceDocId: salesSourceDocId } = await upsertSourceDocFromFile(
        client,
        pilot.paths.salesTaxRatesCsv,
        repoFileUrl(pilot.paths.salesTaxRatesCsv),
        {
          isDemo: true,
          title: `TaxAtlas pilot sales tax rates (${pilot.pilotId})`,
          mimeType: 'text/csv',
        }
      );

      const salesRows = await readCsvRecords<SalesTaxCsv>(pilot.paths.salesTaxRatesCsv);
      let salesProcessed = 0;

      for (const row of salesRows) {
        const jurisdictionId = await getJurisdictionIdByExternalId(
          client,
          pilot.stateCode,
          row.jurisdiction_external_id
        );
        if (!jurisdictionId) {
          throw new Error(`Missing jurisdiction for sales_tax row: external_id=${row.jurisdiction_external_id}`);
        }

        const taxInstrumentId = await upsertTaxInstrument(client, {
          jurisdictionId,
          taxType: 'sales',
          name: row.instrument_name,
          metadata: { pilot: pilot.pilotId },
          sourceDocId: salesSourceDocId,
        });

        const metadata: Record<string, unknown> = { pilot: pilot.pilotId };
        if (row.notes?.trim()) metadata.notes = row.notes.trim();

        await client.query(
          `
          INSERT INTO tax_rate_snapshot (
            tax_instrument_id,
            methodology_version_id,
            effective_date,
            end_date,
            tax_year,
            rate_value,
            rate_unit,
            rate_brackets,
            metadata,
            source_doc_id
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::date,
            NULLIF($4, '')::date,
            NULLIF($5, '')::smallint,
            $6::numeric,
            $7,
            NULL,
            $8::jsonb,
            $9::uuid
          )
          ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date)
          DO UPDATE SET
            end_date = EXCLUDED.end_date,
            tax_year = EXCLUDED.tax_year,
            rate_value = EXCLUDED.rate_value,
            rate_unit = EXCLUDED.rate_unit,
            metadata = EXCLUDED.metadata,
            source_doc_id = EXCLUDED.source_doc_id
          `,
          [
            taxInstrumentId,
            factMethodologyVersionId,
            row.effective_date,
            row.end_date ?? '',
            row.tax_year ?? '',
            toNullableNumber(row.rate_value),
            row.rate_unit,
            JSON.stringify(metadata),
            salesSourceDocId,
          ]
        );

        salesProcessed += 1;
      }

      log.info(`Sales tax rates loaded`, { rows: salesProcessed });

      // -------------------------------------------------------------------
      // State income tax (JSON with brackets)
      // -------------------------------------------------------------------
      if (!(await fileExists(pilot.paths.stateIncomeTaxJson))) {
        throw new Error(`Missing JSON: ${pilot.paths.stateIncomeTaxJson}`);
      }

      const { sourceDocId: incomeSourceDocId } = await upsertSourceDocFromFile(
        client,
        pilot.paths.stateIncomeTaxJson,
        repoFileUrl(pilot.paths.stateIncomeTaxJson),
        {
          isDemo: true,
          title: `TaxAtlas pilot state income tax (${pilot.pilotId})`,
          mimeType: 'application/json',
        }
      );

      const income = await readJsonFile<IncomeTaxJson>(pilot.paths.stateIncomeTaxJson);

      const incomeJurisdictionId = await getJurisdictionIdByExternalId(
        client,
        pilot.stateCode,
        income.jurisdiction_external_id
      );
      if (!incomeJurisdictionId) {
        throw new Error(`Missing jurisdiction for state income tax: external_id=${income.jurisdiction_external_id}`);
      }

      const incomeInstrumentId = await upsertTaxInstrument(client, {
        jurisdictionId: incomeJurisdictionId,
        taxType: 'income' satisfies TaxType,
        name: income.instrument_name,
        metadata: { pilot: pilot.pilotId },
        sourceDocId: incomeSourceDocId,
      });

      const incomeMeta: Record<string, unknown> = { pilot: pilot.pilotId };
      if (income.notes?.trim()) incomeMeta.notes = income.notes.trim();

      await client.query(
        `
        INSERT INTO tax_rate_snapshot (
          tax_instrument_id,
          methodology_version_id,
          effective_date,
          end_date,
          tax_year,
          rate_value,
          rate_unit,
          rate_brackets,
          metadata,
          source_doc_id
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::date,
          NULL,
          $4::smallint,
          NULL,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8::uuid
        )
        ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date)
        DO UPDATE SET
          tax_year = EXCLUDED.tax_year,
          rate_unit = EXCLUDED.rate_unit,
          rate_brackets = EXCLUDED.rate_brackets,
          metadata = EXCLUDED.metadata,
          source_doc_id = EXCLUDED.source_doc_id
        `,
        [
          incomeInstrumentId,
          factMethodologyVersionId,
          income.effective_date,
          income.tax_year ?? null,
          income.rate_unit,
          JSON.stringify(income.rate_brackets),
          JSON.stringify(incomeMeta),
          incomeSourceDocId,
        ]
      );

      log.info(`State income tax loaded`, { instrument: income.instrument_name });
    });
  });

  await pool.end();
  log.info(`Taxes ingest complete`, { pilot: pilot.pilotId });
}

main().catch((err) => {
  log.error('Taxes ingest failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});

