-- TaxAtlas Migration: Payroll Tax Instruments and User Assumption Profiles
-- Version: 0003
-- Description: Adds support for payroll taxes (Social Security, Medicare, FUTA, SUTA,
--              state paid leave, workforce fees) and ephemeral user income assumptions.
--
-- Notes:
-- - assumption_profile stores ephemeral client-side assumptions (no PII, only geo_unit_id reference)
-- - Payroll instruments use tax_type = 'payroll' with extended metadata
-- - payroll_tax_snapshot stores rate/cap/threshold details in structured JSONB
-- - tax_burden_estimate.components extended with payroll breakdown
--
-- =========================
-- === UP (create objects)
-- =========================

BEGIN;

-- ============================================================================
-- New Enums
-- ============================================================================

-- Profile type for income/pay classification
DO $$
BEGIN
  CREATE TYPE taxatlas_profile_type AS ENUM (
    'w2',
    'contractor_1099',
    'self_employed',
    'mixed',
    'unsure'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Payroll instrument category (for grouping and display)
DO $$
BEGIN
  CREATE TYPE taxatlas_payroll_category AS ENUM (
    'social_security',     -- OASDI
    'medicare',            -- HI
    'federal_unemployment', -- FUTA
    'state_unemployment',   -- SUTA
    'state_disability',     -- SDI (CA, NY, etc.)
    'paid_leave',          -- State paid leave programs
    'workforce_fee',       -- State workforce development fees
    'local_payroll',       -- City/county payroll taxes
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Payroll tax payer classification
DO $$
BEGIN
  CREATE TYPE taxatlas_payroll_payer AS ENUM (
    'employee',           -- Withheld from employee wages
    'employer',           -- Paid by employer (not visible on pay stub)
    'shared',             -- Split between employee and employer
    'self_employed'       -- Self-employment tax (both portions)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================================
-- Assumption Profile Table (Ephemeral, Privacy-First)
-- ============================================================================
-- Stores user income assumptions for tax burden calculations.
-- No PII stored - only geo_unit_id for location context.
-- Can be client-side only; this table supports optional server-side persistence.

CREATE TABLE assumption_profile (
  assumption_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ephemeral session identifier (not a user account)
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Location context (no address stored)
  geo_unit_id uuid REFERENCES geo_unit (geo_unit_id) ON DELETE SET NULL,

  -- Profile type
  profile_type taxatlas_profile_type NOT NULL DEFAULT 'unsure',

  -- Income inputs (all nullable - user provides what they want)
  wages_annual numeric(18, 2),          -- W-2 wage income
  contractor_income_annual numeric(18, 2),  -- 1099 income
  household_income_annual numeric(18, 2),   -- Total household (for credits/brackets)

  -- Display preferences
  show_employer_side boolean NOT NULL DEFAULT true,

  -- Spending assumptions (for sales tax estimates)
  spending_annual_taxable numeric(18, 2),

  -- Household context (for certain credits/brackets)
  household_size integer,

  -- Methodology version used for calculations
  methodology_version text NOT NULL DEFAULT 'v1.0',

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- TTL for auto-cleanup (ephemeral by design)
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  -- Constraints
  CHECK (wages_annual IS NULL OR wages_annual >= 0),
  CHECK (contractor_income_annual IS NULL OR contractor_income_annual >= 0),
  CHECK (household_income_annual IS NULL OR household_income_annual >= 0),
  CHECK (spending_annual_taxable IS NULL OR spending_annual_taxable >= 0),
  CHECK (household_size IS NULL OR household_size > 0)
);

CREATE TRIGGER assumption_profile_set_updated_at
BEFORE UPDATE ON assumption_profile
FOR EACH ROW
EXECUTE FUNCTION taxatlas_set_updated_at();

-- Index for session lookups and TTL cleanup
CREATE INDEX assumption_profile_session_idx ON assumption_profile (session_id);
CREATE INDEX assumption_profile_expires_idx ON assumption_profile (expires_at);
CREATE INDEX assumption_profile_geo_unit_idx ON assumption_profile (geo_unit_id)
  WHERE geo_unit_id IS NOT NULL;

-- ============================================================================
-- Payroll Tax Snapshot Table
-- ============================================================================
-- Stores point-in-time payroll tax rates, wage caps, and thresholds.
-- Extends the concept of tax_rate_snapshot with payroll-specific structure.

CREATE TABLE payroll_tax_snapshot (
  payroll_tax_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to parent tax instrument (must be payroll type)
  tax_instrument_id uuid NOT NULL REFERENCES tax_instrument (tax_instrument_id) ON DELETE CASCADE,
  methodology_version_id uuid NOT NULL REFERENCES methodology_version (methodology_version_id),

  -- Temporal validity
  effective_date date NOT NULL,
  end_date date,
  tax_year smallint NOT NULL,

  -- Payroll categorization
  payroll_category taxatlas_payroll_category NOT NULL,
  payer_type taxatlas_payroll_payer NOT NULL,

  -- Rate structure (percentage of wages)
  employee_rate numeric(10, 6),  -- Employee portion (e.g., 0.0620 for 6.2%)
  employer_rate numeric(10, 6),  -- Employer portion
  self_employed_rate numeric(10, 6),  -- SE tax rate (usually employee + employer)

  -- Wage base limits
  wage_base_limit numeric(18, 2),  -- Annual cap (e.g., $168,600 for SS in 2024)
  wage_floor numeric(18, 2),       -- Minimum wages before tax applies

  -- Additional thresholds (JSONB for flexibility)
  -- Example: { "additional_medicare_threshold": 200000, "additional_medicare_rate": 0.009 }
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata for UI display
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Example metadata:
  -- {
  --   "display_name": "Social Security (OASDI)",
  --   "short_name": "Social Security",
  --   "employee_visible": true,
  --   "employer_visible": false,
  --   "applies_to": ["w2", "self_employed"],
  --   "notes": "Subject to wage base limit"
  -- }

  -- Provenance
  source_doc_id uuid NOT NULL REFERENCES source_doc (source_doc_id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (tax_instrument_id, methodology_version_id, effective_date, payroll_category),
  CHECK (end_date IS NULL OR end_date > effective_date),
  CHECK (tax_year >= 1900 AND tax_year <= 2200),
  CHECK (employee_rate IS NULL OR (employee_rate >= 0 AND employee_rate <= 1)),
  CHECK (employer_rate IS NULL OR (employer_rate >= 0 AND employer_rate <= 1)),
  CHECK (self_employed_rate IS NULL OR (self_employed_rate >= 0 AND self_employed_rate <= 1)),
  CHECK (wage_base_limit IS NULL OR wage_base_limit > 0),
  CHECK (wage_floor IS NULL OR wage_floor >= 0),
  CHECK (jsonb_typeof(thresholds) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes for common queries
CREATE INDEX payroll_tax_snapshot_instrument_year_idx
  ON payroll_tax_snapshot (tax_instrument_id, tax_year DESC);
CREATE INDEX payroll_tax_snapshot_category_idx
  ON payroll_tax_snapshot (payroll_category, tax_year DESC);
CREATE INDEX payroll_tax_snapshot_effective_idx
  ON payroll_tax_snapshot (effective_date DESC);

-- ============================================================================
-- Extended Components Schema for tax_burden_estimate
-- ============================================================================
-- The existing tax_burden_estimate.components JSONB can now include:
-- {
--   "income": { "amount": 5000, "rate": 0.0725 },
--   "property": { "amount": 3000, "median_bill": 3000 },
--   "sales": { "amount": 800, "rate": 0.07875 },
--   "payroll": {
--     "employee_paid": {
--       "social_security": { "amount": 9114, "rate": 0.062, "wage_base": 168600 },
--       "medicare": { "amount": 2175, "rate": 0.0145 },
--       "additional_medicare": { "amount": 450, "rate": 0.009, "threshold": 200000 },
--       "state_disability": { "amount": 0 }
--     },
--     "employer_paid": {
--       "social_security": { "amount": 9114, "rate": 0.062, "wage_base": 168600 },
--       "medicare": { "amount": 2175, "rate": 0.0145 },
--       "futa": { "amount": 420, "rate": 0.006, "wage_base": 7000 },
--       "suta": { "amount": 1500, "rate": 0.03, "wage_base": 50000 },
--       "mn_paid_leave": { "amount": 500, "rate": 0.007 },
--       "mn_workforce_fee": { "amount": 14, "rate": 0.0001 }
--     },
--     "program_fees": {
--       "mn_paid_leave_employee": { "amount": 500, "rate": 0.007 }
--     },
--     "total_employee_paid": 11739,
--     "total_employer_paid": 13723,
--     "total_payroll": 25462
--   }
-- }

-- Add comment documenting the expected structure
COMMENT ON COLUMN tax_burden_estimate.components IS
'JSON object containing breakdown by tax type. For payroll, includes:
- employee_paid: taxes withheld from employee wages
- employer_paid: taxes paid by employer (hidden from pay stub)
- program_fees: state program fees (may be split or employer-only)
- total_employee_paid, total_employer_paid, total_payroll: aggregates';

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: Current payroll tax rates for a given year
CREATE OR REPLACE VIEW v_current_payroll_rates AS
SELECT
  pts.payroll_tax_snapshot_id,
  pts.tax_instrument_id,
  ti.name AS instrument_name,
  ti.jurisdiction_id,
  j.name AS jurisdiction_name,
  j.jurisdiction_type,
  j.state_code,
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
  sd.is_demo,
  sd.url AS source_url
FROM payroll_tax_snapshot pts
JOIN tax_instrument ti ON pts.tax_instrument_id = ti.tax_instrument_id
JOIN jurisdiction j ON ti.jurisdiction_id = j.jurisdiction_id
JOIN source_doc sd ON pts.source_doc_id = sd.source_doc_id
WHERE ti.tax_type = 'payroll'
  AND ti.is_active = true
  AND pts.effective_date <= CURRENT_DATE
  AND (pts.end_date IS NULL OR pts.end_date > CURRENT_DATE);

-- ============================================================================
-- Demo Data: Federal Payroll Taxes (2024)
-- ============================================================================
-- Note: These are demo/example rates. Production should use official IRS sources.

-- Insert demo source document
INSERT INTO source_doc (source_doc_id, url, content_sha256, is_demo, title, notes)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'https://www.ssa.gov/oact/cola/cbb.html',
  '0000000000000000000000000000000000000000000000000000000000000010',
  true,
  'Social Security Wage Base (Demo)',
  'Demo data for payroll tax rates. Not for production use.'
) ON CONFLICT DO NOTHING;

INSERT INTO source_doc (source_doc_id, url, content_sha256, is_demo, title, notes)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  'https://www.irs.gov/taxtopics/tc751',
  '0000000000000000000000000000000000000000000000000000000000000011',
  true,
  'IRS FICA and FUTA Rates (Demo)',
  'Demo data for payroll tax rates. Not for production use.'
) ON CONFLICT DO NOTHING;

INSERT INTO source_doc (source_doc_id, url, content_sha256, is_demo, title, notes)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  'https://mn.gov/deed/paidleave/',
  '0000000000000000000000000000000000000000000000000000000000000012',
  true,
  'Minnesota Paid Leave Program (Demo)',
  'Demo data for MN paid leave rates. Not for production use.'
) ON CONFLICT DO NOTHING;

-- Insert methodology version for payroll
INSERT INTO methodology_version (methodology_version_id, kind, name, version, description)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'estimate',
  'payroll_v1',
  '1.0.0',
  'Payroll tax estimation methodology v1. Uses standard federal rates and state-specific adjustments.'
) ON CONFLICT DO NOTHING;

-- Insert federal jurisdiction (if not exists)
INSERT INTO jurisdiction (jurisdiction_id, jurisdiction_type, name, state_code, external_id, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'federal',
  'United States Federal Government',
  'US',
  'US-FEDERAL',
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;

-- Insert Minnesota state jurisdiction (if not exists)
INSERT INTO jurisdiction (jurisdiction_id, jurisdiction_type, name, state_code, external_id, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  'state',
  'State of Minnesota',
  'MN',
  'MN-STATE',
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Federal Payroll Tax Instruments
-- ============================================================================

-- Social Security (OASDI)
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000030',
  'payroll',
  'Social Security (OASDI)',
  'Old-Age, Survivors, and Disability Insurance tax under FICA',
  '{
    "payroll_category": "social_security",
    "fica_component": true,
    "display_order": 1,
    "employee_visible": true,
    "employer_visible": false,
    "microcopy": "Social Security tax funds retirement, disability, and survivor benefits."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;

-- Medicare (HI)
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000030',
  'payroll',
  'Medicare (HI)',
  'Hospital Insurance tax under FICA',
  '{
    "payroll_category": "medicare",
    "fica_component": true,
    "display_order": 2,
    "employee_visible": true,
    "employer_visible": false,
    "microcopy": "Medicare tax funds hospital insurance for those 65+ and certain disabled individuals."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- Additional Medicare Tax
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000030',
  'payroll',
  'Additional Medicare Tax',
  'Additional 0.9% Medicare tax on wages above threshold',
  '{
    "payroll_category": "medicare",
    "fica_component": true,
    "is_surtax": true,
    "display_order": 3,
    "employee_visible": true,
    "employer_visible": false,
    "microcopy": "Additional Medicare tax applies to wages above $200,000 (single) or $250,000 (married filing jointly)."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- FUTA
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000043',
  '00000000-0000-0000-0000-000000000030',
  'payroll',
  'Federal Unemployment Tax (FUTA)',
  'Federal unemployment insurance tax paid by employers',
  '{
    "payroll_category": "federal_unemployment",
    "display_order": 4,
    "employee_visible": false,
    "employer_visible": true,
    "microcopy": "FUTA funds unemployment benefits. Employers pay this tax; employees do not see it deducted."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Minnesota State Payroll Tax Instruments
-- ============================================================================

-- Minnesota SUTA
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000031',
  'payroll',
  'Minnesota Unemployment Insurance (SUTA)',
  'State unemployment insurance tax',
  '{
    "payroll_category": "state_unemployment",
    "display_order": 5,
    "employee_visible": false,
    "employer_visible": true,
    "microcopy": "Minnesota UI tax funds state unemployment benefits. Rate varies by employer experience."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- Minnesota Paid Family and Medical Leave (effective 2026)
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000031',
  'payroll',
  'Minnesota Paid Leave Program',
  'Minnesota Paid Family and Medical Leave premium',
  '{
    "payroll_category": "paid_leave",
    "display_order": 6,
    "employee_visible": true,
    "employer_visible": true,
    "is_program_fee": true,
    "effective_year": 2026,
    "microcopy": "MN Paid Leave provides wage replacement for family and medical leave. Cost is shared between employer and employee."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- Minnesota Workforce Development Fee
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, metadata, source_doc_id)
VALUES (
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000031',
  'payroll',
  'Minnesota Workforce Development Fee',
  'State workforce development assessment',
  '{
    "payroll_category": "workforce_fee",
    "display_order": 7,
    "employee_visible": false,
    "employer_visible": true,
    "is_program_fee": true,
    "microcopy": "Funds Minnesota workforce training and development programs."
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Payroll Tax Snapshots (2024 Demo Rates)
-- ============================================================================

-- Social Security 2024
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employee_rate, employer_rate, self_employed_rate,
  wage_base_limit, metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'social_security', 'shared', 0.062, 0.062, 0.124,
  168600,
  '{
    "display_name": "Social Security",
    "applies_to": ["w2", "self_employed"],
    "notes": "Subject to annual wage base limit"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;

-- Medicare 2024 (no wage base limit)
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employee_rate, employer_rate, self_employed_rate,
  metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'medicare', 'shared', 0.0145, 0.0145, 0.029,
  '{
    "display_name": "Medicare",
    "applies_to": ["w2", "self_employed"],
    "notes": "No wage base limit"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- Additional Medicare Tax 2024
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employee_rate, wage_floor,
  thresholds, metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'medicare', 'employee', 0.009, 200000,
  '{
    "single_threshold": 200000,
    "married_joint_threshold": 250000,
    "married_separate_threshold": 125000
  }'::jsonb,
  '{
    "display_name": "Additional Medicare Tax",
    "applies_to": ["w2", "self_employed"],
    "is_surtax": true,
    "notes": "Employee-only; applies above threshold"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- FUTA 2024
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000043',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'federal_unemployment', 'employer', 0.006, 7000,
  '{
    "gross_rate": 0.06,
    "state_credit_max": 0.054,
    "effective_rate_with_credit": 0.006
  }'::jsonb,
  '{
    "display_name": "FUTA",
    "applies_to": ["w2"],
    "employer_only": true,
    "notes": "0.6% effective rate after state credit (up to 5.4%)"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000011'
) ON CONFLICT DO NOTHING;

-- Minnesota SUTA 2024 (example new employer rate)
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'state_unemployment', 'employer', 0.01, 42000,
  '{
    "new_employer_rate": 0.01,
    "min_rate": 0.001,
    "max_rate": 0.09,
    "base_rate": 0.01
  }'::jsonb,
  '{
    "display_name": "MN Unemployment Insurance",
    "applies_to": ["w2"],
    "employer_only": true,
    "notes": "Rate varies by employer experience; 1% shown is new employer rate"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- Minnesota Paid Leave 2026 (not yet effective, but show as upcoming)
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employee_rate, employer_rate,
  metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000020',
  '2026-01-01', 2026,
  'paid_leave', 'shared', 0.004, 0.003,
  '{
    "display_name": "MN Paid Leave",
    "applies_to": ["w2"],
    "is_program_fee": true,
    "total_rate": 0.007,
    "notes": "0.7% total: 0.4% employee, 0.3% employer (employer may pay more)"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

-- Minnesota Workforce Development Fee 2024
INSERT INTO payroll_tax_snapshot (
  tax_instrument_id, methodology_version_id, effective_date, tax_year,
  payroll_category, payer_type, employer_rate, wage_base_limit,
  metadata, source_doc_id
) VALUES (
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000020',
  '2024-01-01', 2024,
  'workforce_fee', 'employer', 0.0001, 42000,
  '{
    "display_name": "MN Workforce Fee",
    "applies_to": ["w2"],
    "employer_only": true,
    "notes": "0.01% (1 basis point) on taxable wages"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000012'
) ON CONFLICT DO NOTHING;

COMMIT;

-- =========================
-- === DOWN (drop objects)
-- =========================
-- Run manually if needed to rollback:
--
-- BEGIN;
-- DROP VIEW IF EXISTS v_current_payroll_rates;
-- DROP TABLE IF EXISTS payroll_tax_snapshot;
-- DROP TABLE IF EXISTS assumption_profile;
-- DROP TYPE IF EXISTS taxatlas_payroll_payer;
-- DROP TYPE IF EXISTS taxatlas_payroll_category;
-- DROP TYPE IF EXISTS taxatlas_profile_type;
-- COMMIT;
