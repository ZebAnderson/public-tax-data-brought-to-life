import type { DbClient } from './db.js';

export type GeoUnitType =
  | 'tract'
  | 'block_group'
  | 'zip'
  | 'neighborhood'
  | 'city'
  | 'county'
  | 'state'
  | 'custom';

export type JurisdictionType =
  | 'state'
  | 'county'
  | 'city'
  | 'school'
  | 'special'
  | 'federal'
  | 'other';

export type TaxType =
  | 'property'
  | 'sales'
  | 'income'
  | 'payroll'
  | 'corporate'
  | 'excise'
  | 'lodging'
  | 'utility'
  | 'other';

export interface UpsertGeoUnitInput {
  geoUnitType: GeoUnitType;
  geoid: string;
  name: string;
  stateCode: string;
  stateFips?: string | null;
  countyFips?: string | null;
  geomGeoJson: unknown;
  geomSrid: number;
  sourceDocId: string;
  countryCode?: string;
}

export async function upsertGeoUnit(
  client: DbClient,
  input: UpsertGeoUnitInput
): Promise<string> {
  const result = await client.query<{ geo_unit_id: string }>(
    `
    INSERT INTO geo_unit (
      geo_unit_type,
      geoid,
      name,
      country_code,
      state_code,
      state_fips,
      county_fips,
      geom,
      source_doc_id
    )
    VALUES (
      $1::taxatlas_geo_unit_type,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($8), $9), 4326)),
      $10::uuid
    )
    ON CONFLICT (geo_unit_type, geoid)
    DO UPDATE SET
      name = EXCLUDED.name,
      country_code = EXCLUDED.country_code,
      state_code = EXCLUDED.state_code,
      state_fips = EXCLUDED.state_fips,
      county_fips = EXCLUDED.county_fips,
      geom = EXCLUDED.geom,
      source_doc_id = EXCLUDED.source_doc_id
    RETURNING geo_unit_id
    `,
    [
      input.geoUnitType,
      input.geoid,
      input.name,
      input.countryCode ?? 'US',
      input.stateCode,
      input.stateFips ?? null,
      input.countyFips ?? null,
      JSON.stringify(input.geomGeoJson),
      input.geomSrid,
      input.sourceDocId,
    ]
  );
  return result.rows[0].geo_unit_id;
}

export async function getGeoUnitId(
  client: DbClient,
  geoUnitType: GeoUnitType,
  geoid: string
): Promise<string | null> {
  const result = await client.query<{ geo_unit_id: string }>(
    `SELECT geo_unit_id FROM geo_unit WHERE geo_unit_type = $1::taxatlas_geo_unit_type AND geoid = $2 LIMIT 1`,
    [geoUnitType, geoid]
  );
  return result.rows[0]?.geo_unit_id ?? null;
}

export interface UpsertJurisdictionInput {
  jurisdictionType: JurisdictionType;
  name: string;
  stateCode: string;
  externalId: string;
  parentJurisdictionId?: string | null;
  geomGeoJson?: unknown | null;
  geomSrid?: number;
  sourceDocId: string;
  countryCode?: string;
}

export async function upsertJurisdiction(
  client: DbClient,
  input: UpsertJurisdictionInput
): Promise<string> {
  const result = await client.query<{ jurisdiction_id: string }>(
    `
    INSERT INTO jurisdiction (
      jurisdiction_type,
      name,
      country_code,
      state_code,
      external_id,
      parent_jurisdiction_id,
      geom,
      source_doc_id
    )
    VALUES (
      $1::taxatlas_jurisdiction_type,
      $2,
      $3,
      $4,
      $5,
      $6::uuid,
      CASE
        WHEN $7 IS NULL THEN NULL
        ELSE ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($7), $8), 4326))
      END,
      $9::uuid
    )
    ON CONFLICT (jurisdiction_type, state_code, external_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      parent_jurisdiction_id = EXCLUDED.parent_jurisdiction_id,
      geom = EXCLUDED.geom,
      source_doc_id = EXCLUDED.source_doc_id
    RETURNING jurisdiction_id
    `,
    [
      input.jurisdictionType,
      input.name,
      input.countryCode ?? 'US',
      input.stateCode,
      input.externalId,
      input.parentJurisdictionId ?? null,
      input.geomGeoJson == null ? null : JSON.stringify(input.geomGeoJson),
      input.geomSrid ?? 4326,
      input.sourceDocId,
    ]
  );
  return result.rows[0].jurisdiction_id;
}

export async function getJurisdictionIdByExternalId(
  client: DbClient,
  stateCode: string,
  externalId: string
): Promise<string | null> {
  const result = await client.query<{ jurisdiction_id: string }>(
    `SELECT jurisdiction_id FROM jurisdiction WHERE state_code = $1 AND external_id = $2 LIMIT 1`,
    [stateCode, externalId]
  );
  return result.rows[0]?.jurisdiction_id ?? null;
}

export interface UpsertTaxInstrumentInput {
  jurisdictionId: string;
  taxType: TaxType;
  name: string;
  description?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  sourceDocId: string;
}

export async function upsertTaxInstrument(
  client: DbClient,
  input: UpsertTaxInstrumentInput
): Promise<string> {
  const result = await client.query<{ tax_instrument_id: string }>(
    `
    INSERT INTO tax_instrument (
      jurisdiction_id,
      tax_type,
      name,
      description,
      is_active,
      metadata,
      source_doc_id
    )
    VALUES ($1::uuid, $2::taxatlas_tax_type, $3, $4, COALESCE($5, true), COALESCE($6::jsonb, '{}'::jsonb), $7::uuid)
    ON CONFLICT (jurisdiction_id, tax_type, name)
    DO UPDATE SET
      description = COALESCE(EXCLUDED.description, tax_instrument.description),
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      source_doc_id = EXCLUDED.source_doc_id
    RETURNING tax_instrument_id
    `,
    [
      input.jurisdictionId,
      input.taxType,
      input.name,
      input.description ?? null,
      input.isActive ?? true,
      JSON.stringify(input.metadata ?? {}),
      input.sourceDocId,
    ]
  );
  return result.rows[0].tax_instrument_id;
}

export async function getTaxInstrumentId(
  client: DbClient,
  jurisdictionId: string,
  taxType: TaxType,
  name: string
): Promise<string | null> {
  const result = await client.query<{ tax_instrument_id: string }>(
    `
    SELECT tax_instrument_id
    FROM tax_instrument
    WHERE jurisdiction_id = $1::uuid AND tax_type = $2::taxatlas_tax_type AND name = $3
    LIMIT 1
    `,
    [jurisdictionId, taxType, name]
  );
  return result.rows[0]?.tax_instrument_id ?? null;
}
