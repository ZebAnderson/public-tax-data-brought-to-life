-- TaxAtlas (Postgres + PostGIS) schema
-- Single-file migration with UP and DOWN sections.
--
-- Notes:
-- - Requires extensions: postgis, pgcrypto, citext, pg_trgm
-- - Uses UUID PKs (gen_random_uuid()) for stable identifiers across ingests.
-- - Stores geometries in EPSG:4326.
-- - Most fact tables require a source_doc_id (provenance) and methodology_version_id (estimation lineage).
--
-- =========================
-- === UP (create objects)
-- =========================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enumerations (prefixed to avoid collisions with other schemas/apps)
DO $$
BEGIN
  CREATE TYPE taxatlas_geo_unit_type AS ENUM (
    'tract',
    'block_group',
    'zip',
    'neighborhood',
    'city',
    'county',
    'state',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_jurisdiction_type AS ENUM (
    'state',
    'county',
    'city',
    'school',
    'special',
    'federal',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_tax_type AS ENUM (
    'property',
    'sales',
    'income',
    'payroll',
    'corporate',
    'excise',
    'lodging',
    'utility',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_decision_event_type AS ENUM (
    'budget',
    'levy',
    'rate_change',
    'referendum',
    'statute',
    'ordinance',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_impact_direction AS ENUM (
    'increase',
    'decrease',
    'no_change',
    'restructure',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_vote_record_type AS ENUM (
    'roll_call',
    'ballot_measure',
    'referendum',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_vote_value AS ENUM (
    'yes',
    'no',
    'abstain',
    'absent',
    'present',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_policy_signal_status AS ENUM (
    'proposed',
    'pending',
    'enacted',
    'withdrawn',
    'expired',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_data_kind AS ENUM (
    'fact',
    'estimate',
    'signal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE taxatlas_presence_mode AS ENUM (
    'live',
    'work',
    'live_work'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Core provenance + lineage tables
CREATE TABLE methodology_version (
  methodology_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind taxatlas_data_kind NOT NULL DEFAULT 'estimate',
  name text NOT NULL,
  version text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE source_doc (
  source_doc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  content_sha256 char(64) NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz,
  published_at date,
  title text,
  mime_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, content_sha256),
  CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX source_doc_sha256_idx ON source_doc (content_sha256);
CREATE INDEX source_doc_is_demo_idx ON source_doc (is_demo);

-- Utility trigger to keep updated_at current
CREATE OR REPLACE FUNCTION taxatlas_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Canonical geographies
CREATE TABLE geo_unit (
  geo_unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_unit_type taxatlas_geo_unit_type NOT NULL,
  geoid text NOT NULL,
  name text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'US',
  state_code char(2) NOT NULL,
  state_fips char(2),
  county_fips char(3),
  geom geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326) GENERATED ALWAYS AS (ST_PointOnSurface(geom)) STORED,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (geo_unit_type, geoid),
  CHECK (country_code ~ '^[A-Z]{2}$'),
  CHECK (state_code ~ '^[A-Z]{2}$'),
  CHECK (state_fips IS NULL OR state_fips ~ '^[0-9]{2}$'),
  CHECK (county_fips IS NULL OR county_fips ~ '^[0-9]{3}$')
);

CREATE TRIGGER geo_unit_set_updated_at
BEFORE UPDATE ON geo_unit
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

CREATE INDEX geo_unit_state_type_idx ON geo_unit (state_code, geo_unit_type);
CREATE INDEX geo_unit_geoid_idx ON geo_unit (geoid);
CREATE INDEX geo_unit_geom_gix ON geo_unit USING GIST (geom);
CREATE INDEX geo_unit_centroid_gix ON geo_unit USING GIST (centroid);

-- User-facing search surface: alias text -> geo_unit
CREATE TABLE place_alias (
  place_alias_id bigserial PRIMARY KEY,
  alias_text citext NOT NULL,
  state_code char(2) NOT NULL,
  geo_unit_id uuid NOT NULL REFERENCES geo_unit (geo_unit_id) ON DELETE CASCADE,
  alias_kind text NOT NULL DEFAULT 'name',
  alias_rank integer NOT NULL DEFAULT 0,
  is_preferred boolean NOT NULL DEFAULT false,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias_text, state_code, geo_unit_id, alias_kind),
  CHECK (state_code ~ '^[A-Z]{2}$'),
  CHECK (alias_rank >= 0)
);

-- Fast exact resolution (alias_text + optional state) and ranked disambiguation.
CREATE INDEX place_alias_resolve_idx ON place_alias (alias_text, state_code, alias_rank DESC);
CREATE INDEX place_alias_geo_unit_idx ON place_alias (geo_unit_id);
-- Optional: fast "did you mean" / autocomplete.
CREATE INDEX place_alias_alias_text_trgm_gin ON place_alias USING GIN ((alias_text::text) gin_trgm_ops);

-- Jurisdictions that can set/apply tax instruments
CREATE TABLE jurisdiction (
  jurisdiction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_type taxatlas_jurisdiction_type NOT NULL,
  name text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'US',
  state_code char(2) NOT NULL,
  external_id text,
  parent_jurisdiction_id uuid REFERENCES jurisdiction (jurisdiction_id),
  geom geometry(MultiPolygon, 4326),
  centroid geometry(Point, 4326)
    GENERATED ALWAYS AS (CASE WHEN geom IS NULL THEN NULL ELSE ST_PointOnSurface(geom) END) STORED,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_type, state_code, external_id),
  CHECK (country_code ~ '^[A-Z]{2}$'),
  CHECK (state_code ~ '^[A-Z]{2}$'),
  CHECK (parent_jurisdiction_id IS NULL OR parent_jurisdiction_id <> jurisdiction_id)
);

CREATE TRIGGER jurisdiction_set_updated_at
BEFORE UPDATE ON jurisdiction
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

CREATE INDEX jurisdiction_type_state_idx ON jurisdiction (jurisdiction_type, state_code);
CREATE INDEX jurisdiction_parent_idx ON jurisdiction (parent_jurisdiction_id);
CREATE INDEX jurisdiction_geom_gix ON jurisdiction USING GIST (geom);

-- Many-to-many mapping from geo_units to the jurisdictions that cover them.
-- coverage_ratio supports partial overlaps (e.g., special districts, split tracts).
CREATE TABLE geo_unit_jurisdiction (
  geo_unit_id uuid NOT NULL REFERENCES geo_unit (geo_unit_id) ON DELETE CASCADE,
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  coverage_ratio numeric(7, 6) NOT NULL,
  coverage_area_m2 double precision,
  notes text,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_unit_id, jurisdiction_id, methodology_version_id),
  CHECK (coverage_ratio >= 0 AND coverage_ratio <= 1)
);

CREATE INDEX geo_unit_jurisdiction_jurisdiction_idx ON geo_unit_jurisdiction (jurisdiction_id, geo_unit_id);
CREATE INDEX geo_unit_jurisdiction_geo_method_idx
  ON geo_unit_jurisdiction (geo_unit_id, methodology_version_id, coverage_ratio DESC);

-- Tax instruments defined by a jurisdiction (e.g., "General sales tax", "Property tax levy")
CREATE TABLE tax_instrument (
  tax_instrument_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  tax_type taxatlas_tax_type NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, tax_type, name),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TRIGGER tax_instrument_set_updated_at
BEFORE UPDATE ON tax_instrument
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

CREATE INDEX tax_instrument_jurisdiction_type_idx ON tax_instrument (jurisdiction_id, tax_type);
CREATE INDEX tax_instrument_type_idx ON tax_instrument (tax_type);

-- Tax rates over time. Supports bracketed structures via rate_brackets JSONB.
CREATE TABLE tax_rate_snapshot (
  tax_rate_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_instrument_id uuid NOT NULL REFERENCES tax_instrument (tax_instrument_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  effective_date date NOT NULL,
  end_date date,
  tax_year smallint,
  rate_value numeric(18, 8),
  rate_unit text NOT NULL,
  rate_brackets jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tax_instrument_id, methodology_version_id, effective_date),
  CHECK (end_date IS NULL OR end_date > effective_date),
  CHECK (tax_year IS NULL OR (tax_year >= 1900 AND tax_year <= 2200)),
  CHECK ((rate_value IS NOT NULL) OR (rate_brackets IS NOT NULL)),
  CHECK (rate_brackets IS NULL OR jsonb_typeof(rate_brackets) IN ('object', 'array')),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX tax_rate_snapshot_instrument_effective_idx
  ON tax_rate_snapshot (tax_instrument_id, effective_date DESC);
CREATE INDEX tax_rate_snapshot_instrument_tax_year_idx
  ON tax_rate_snapshot (tax_instrument_id, tax_year DESC)
  WHERE tax_year IS NOT NULL;

-- Property-tax-specific context snapshots at a geo_unit level.
-- Typically derived from jurisdiction-level levy/rate + parcel/value rolls and allocated to geo units.
CREATE TABLE property_tax_context_snapshot (
  property_tax_context_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_instrument_id uuid NOT NULL REFERENCES tax_instrument (tax_instrument_id) ON DELETE CASCADE,
  geo_unit_id uuid NOT NULL REFERENCES geo_unit (geo_unit_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  tax_year smallint NOT NULL,
  levy_amount numeric(18, 2),
  taxable_value_amount numeric(18, 2),
  tax_capacity_amount numeric(18, 2),
  median_bill_amount numeric(18, 2),
  bill_p25_amount numeric(18, 2),
  bill_p75_amount numeric(18, 2),
  parcel_count integer,
  household_count integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tax_instrument_id, geo_unit_id, methodology_version_id, tax_year),
  CHECK (tax_year >= 1900 AND tax_year <= 2200),
  CHECK (parcel_count IS NULL OR parcel_count >= 0),
  CHECK (household_count IS NULL OR household_count >= 0),
  CHECK (jsonb_typeof(metadata) = 'object')
);

-- Covers "fetch summary for geo_unit + year" and "latest property tax card".
CREATE INDEX property_tax_context_geo_method_year_idx
  ON property_tax_context_snapshot (geo_unit_id, methodology_version_id, tax_year DESC);
CREATE INDEX property_tax_context_instrument_method_year_idx
  ON property_tax_context_snapshot (tax_instrument_id, methodology_version_id, tax_year DESC);

-- Modeled total tax burden (for "live here" / "work here" / "live+work" screens).
-- This is intentionally flexible: store scenario assumptions and component breakdowns as JSONB.
CREATE TABLE tax_burden_estimate (
  tax_burden_estimate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_unit_id uuid NOT NULL REFERENCES geo_unit (geo_unit_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  tax_year smallint NOT NULL,
  presence_mode taxatlas_presence_mode NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_amount numeric(18, 2) NOT NULL,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (geo_unit_id, methodology_version_id, tax_year, presence_mode),
  CHECK (tax_year >= 1900 AND tax_year <= 2200),
  CHECK (currency_code ~ '^[A-Z]{3}$'),
  CHECK (jsonb_typeof(scenario) = 'object'),
  CHECK (jsonb_typeof(components) = 'object')
);

CREATE INDEX tax_burden_estimate_geo_method_year_idx
  ON tax_burden_estimate (geo_unit_id, methodology_version_id, tax_year DESC, presence_mode);

-- Decisions that affect taxes (budgets, rate changes, referenda, statutes, ordinances)
CREATE TABLE decision_event (
  decision_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  event_type taxatlas_decision_event_type NOT NULL,
  event_date date NOT NULL,
  effective_date date,
  title text NOT NULL,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_date IS NULL OR effective_date >= event_date),
  CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX decision_event_jurisdiction_date_idx
  ON decision_event (jurisdiction_id, event_date DESC);
CREATE INDEX decision_event_date_idx
  ON decision_event (event_date DESC);
CREATE INDEX decision_event_type_idx
  ON decision_event (event_type);

-- Link decisions to the affected tax instruments and quantify direction/magnitude.
CREATE TABLE decision_tax_impact (
  decision_tax_impact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_event_id uuid NOT NULL REFERENCES decision_event (decision_event_id) ON DELETE CASCADE,
  tax_instrument_id uuid NOT NULL REFERENCES tax_instrument (tax_instrument_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  impact_direction taxatlas_impact_direction NOT NULL,
  tax_year smallint,
  delta_rate_value numeric(18, 8),
  delta_revenue_amount numeric(18, 2),
  delta_description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_event_id, tax_instrument_id, methodology_version_id),
  CHECK (tax_year IS NULL OR (tax_year >= 1900 AND tax_year <= 2200)),
  CHECK ((delta_rate_value IS NOT NULL) OR (delta_revenue_amount IS NOT NULL) OR (delta_description IS NOT NULL)),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX decision_tax_impact_instrument_idx ON decision_tax_impact (tax_instrument_id);
CREATE INDEX decision_tax_impact_event_idx ON decision_tax_impact (decision_event_id);
CREATE INDEX decision_tax_impact_instrument_year_idx
  ON decision_tax_impact (tax_instrument_id, tax_year DESC)
  WHERE tax_year IS NOT NULL;

-- People + accountability
CREATE TABLE person (
  person_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  given_name text,
  family_name text,
  email text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(external_ids) = 'object')
);

CREATE TRIGGER person_set_updated_at
BEFORE UPDATE ON person
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

CREATE INDEX person_full_name_idx ON person (full_name);

CREATE TABLE office (
  office_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  office_name text NOT NULL,
  office_category text,
  district_geo_unit_id uuid REFERENCES geo_unit (geo_unit_id),
  seats_count integer,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, office_name, district_geo_unit_id),
  CHECK (seats_count IS NULL OR seats_count > 0)
);

CREATE TRIGGER office_set_updated_at
BEFORE UPDATE ON office
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

CREATE INDEX office_jurisdiction_idx ON office (jurisdiction_id);

CREATE TABLE term (
  term_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES person (person_id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES office (office_id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  elected_date date,
  party text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, office_id, start_date),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX term_office_dates_idx ON term (office_id, start_date, end_date);
CREATE INDEX term_person_dates_idx ON term (person_id, start_date, end_date);

-- Votes (roll call or ballot) tied to a decision event
CREATE TABLE vote_record (
  vote_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_event_id uuid NOT NULL REFERENCES decision_event (decision_event_id) ON DELETE CASCADE,
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  vote_type taxatlas_vote_record_type NOT NULL,
  vote_date date NOT NULL,
  question text,
  passed boolean,
  yes_count integer,
  no_count integer,
  abstain_count integer,
  absent_count integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (yes_count IS NULL OR yes_count >= 0),
  CHECK (no_count IS NULL OR no_count >= 0),
  CHECK (abstain_count IS NULL OR abstain_count >= 0),
  CHECK (absent_count IS NULL OR absent_count >= 0),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX vote_record_decision_idx ON vote_record (decision_event_id);
CREATE INDEX vote_record_jurisdiction_date_idx ON vote_record (jurisdiction_id, vote_date DESC);

CREATE TABLE vote_cast (
  vote_cast_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_record_id uuid NOT NULL REFERENCES vote_record (vote_record_id) ON DELETE CASCADE,
  voter_person_id uuid REFERENCES person (person_id) ON DELETE CASCADE,
  voter_geo_unit_id uuid REFERENCES geo_unit (geo_unit_id) ON DELETE CASCADE,
  vote_value taxatlas_vote_value NOT NULL,
  weight numeric(18, 6) NOT NULL DEFAULT 1,
  notes text,
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (weight > 0),
  CHECK ((voter_person_id IS NOT NULL) <> (voter_geo_unit_id IS NOT NULL))
);

CREATE INDEX vote_cast_vote_record_idx ON vote_cast (vote_record_id);
CREATE INDEX vote_cast_person_idx ON vote_cast (voter_person_id) WHERE voter_person_id IS NOT NULL;
CREATE INDEX vote_cast_geo_unit_idx ON vote_cast (voter_geo_unit_id) WHERE voter_geo_unit_id IS NOT NULL;
CREATE UNIQUE INDEX vote_cast_unique_person_idx
  ON vote_cast (vote_record_id, voter_person_id) WHERE voter_person_id IS NOT NULL;
CREATE UNIQUE INDEX vote_cast_unique_geo_unit_idx
  ON vote_cast (vote_record_id, voter_geo_unit_id) WHERE voter_geo_unit_id IS NOT NULL;

-- Early warning signals before a formal decision (proposals, pending ballot measures, draft budgets)
CREATE TABLE policy_signal (
  policy_signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdiction (jurisdiction_id) ON DELETE CASCADE,
  tax_instrument_id uuid REFERENCES tax_instrument (tax_instrument_id) ON DELETE SET NULL,
  tax_type taxatlas_tax_type,
  status taxatlas_policy_signal_status NOT NULL,
  signal_date date NOT NULL,
  title text NOT NULL,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tax_instrument_id IS NOT NULL OR tax_type IS NOT NULL),
  CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX policy_signal_jurisdiction_date_idx
  ON policy_signal (jurisdiction_id, signal_date DESC);
CREATE INDEX policy_signal_instrument_idx
  ON policy_signal (tax_instrument_id);
CREATE INDEX policy_signal_tax_type_idx
  ON policy_signal (tax_type);

COMMIT;

-- =========================
-- === DOWN (drop objects)
-- =========================
-- If you need a down migration, run the statements below manually.
--
-- BEGIN;
-- DROP TABLE IF EXISTS policy_signal;
-- DROP TABLE IF EXISTS vote_cast;
-- DROP TABLE IF EXISTS vote_record;
-- DROP TABLE IF EXISTS term;
-- DROP TABLE IF EXISTS office;
-- DROP TABLE IF EXISTS person;
-- DROP TABLE IF EXISTS decision_tax_impact;
-- DROP TABLE IF EXISTS decision_event;
-- DROP TABLE IF EXISTS property_tax_context_snapshot;
-- DROP TABLE IF EXISTS tax_burden_estimate;
-- DROP TABLE IF EXISTS tax_rate_snapshot;
-- DROP TABLE IF EXISTS tax_instrument;
-- DROP TABLE IF EXISTS geo_unit_jurisdiction;
-- DROP TABLE IF EXISTS jurisdiction;
-- DROP TABLE IF EXISTS place_alias;
-- DROP TABLE IF EXISTS geo_unit;
-- DROP FUNCTION IF EXISTS taxatlas_set_updated_at;
-- DROP TABLE IF EXISTS source_doc;
-- DROP TABLE IF EXISTS methodology_version;
-- DROP TYPE IF EXISTS taxatlas_policy_signal_status;
-- DROP TYPE IF EXISTS taxatlas_vote_value;
-- DROP TYPE IF EXISTS taxatlas_vote_record_type;
-- DROP TYPE IF EXISTS taxatlas_impact_direction;
-- DROP TYPE IF EXISTS taxatlas_decision_event_type;
-- DROP TYPE IF EXISTS taxatlas_tax_type;
-- DROP TYPE IF EXISTS taxatlas_jurisdiction_type;
-- DROP TYPE IF EXISTS taxatlas_geo_unit_type;
-- DROP TYPE IF EXISTS taxatlas_presence_mode;
-- DROP TYPE IF EXISTS taxatlas_data_kind;
-- COMMIT;
