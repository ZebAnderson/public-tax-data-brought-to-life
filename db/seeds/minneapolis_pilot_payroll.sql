-- ============================================================================
-- Minneapolis Pilot: Payroll Tax Instruments and Snapshots (DEMO DATA ONLY)
-- ============================================================================
--
-- This seed file populates demo payroll tax data for the Minneapolis pilot.
-- ALL DATA IS FOR DEMONSTRATION PURPOSES ONLY.
--
-- DO NOT use these rates for actual tax calculations. These are approximations
-- based on publicly available information and may not reflect current law.
--
-- Includes:
--   - Federal: Social Security (OASDI), Medicare (HI), Additional Medicare, FUTA
--   - Minnesota: SUTA, Paid Family & Medical Leave, Workforce Development Fee
--   - Historical snapshots: 2018-2025
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- DEMO Source Documents
-- ============================================================================
-- All source documents are marked is_demo=true with "DEMO DATA — " prefix

INSERT INTO source_doc (source_doc_id, url, content_sha256, is_demo, title, notes, retrieved_at)
VALUES
  -- Federal payroll sources (SHA256 hashes are 64 hex chars)
  ('10000000-0000-0000-0001-000000000001',
   'https://www.ssa.gov/oact/cola/cbb.html',
   'de01000000000000000000000000000000000000000000000000000000000001',
   true,
   'DEMO DATA — SSA Contribution and Benefit Base (Historical)',
   'Demo data showing historical Social Security wage base limits. Not for production use.',
   now()),

  ('10000000-0000-0000-0001-000000000002',
   'https://www.irs.gov/taxtopics/tc751',
   'de01000000000000000000000000000000000000000000000000000000000002',
   true,
   'DEMO DATA — IRS FICA Tax Rates (Historical)',
   'Demo data showing FICA tax rates. Not for production use.',
   now()),

  ('10000000-0000-0000-0001-000000000003',
   'https://www.irs.gov/taxtopics/tc759',
   'de01000000000000000000000000000000000000000000000000000000000003',
   true,
   'DEMO DATA — IRS FUTA Tax Rate (Historical)',
   'Demo data showing FUTA rates. Not for production use.',
   now()),

  -- Minnesota payroll sources
  ('10000000-0000-0000-0001-000000000010',
   'https://uimn.org/employers/employer-account/tax-rates/',
   'de01000000000000000000000000000000000000000000000000000000000010',
   true,
   'DEMO DATA — Minnesota Unemployment Insurance Tax Rates',
   'Demo data showing MN SUTA rates. Actual rates vary by employer experience.',
   now()),

  ('10000000-0000-0000-0001-000000000011',
   'https://mn.gov/deed/paidleave/',
   'de01000000000000000000000000000000000000000000000000000000000011',
   true,
   'DEMO DATA — Minnesota Paid Family & Medical Leave Program',
   'Demo data for MN Paid Leave program. Program begins 2026.',
   now()),

  ('10000000-0000-0000-0001-000000000012',
   'https://uimn.org/employers/employer-account/tax-rates/workforce-development/',
   'de01000000000000000000000000000000000000000000000000000000000012',
   true,
   'DEMO DATA — Minnesota Workforce Development Fee',
   'Demo data for MN workforce development assessment.',
   now())

ON CONFLICT (source_doc_id) DO UPDATE SET
  title = EXCLUDED.title,
  notes = EXCLUDED.notes,
  is_demo = true;

-- ============================================================================
-- Methodology Version for Payroll Estimates
-- ============================================================================

INSERT INTO methodology_version (methodology_version_id, kind, name, version, description)
VALUES (
  '20000000-0000-0000-0001-000000000001',
  'estimate',
  'payroll_demo_v1',
  '1.0.0-demo',
  'DEMO: Payroll tax estimation methodology. Uses approximate rates for demonstration.'
)
ON CONFLICT (methodology_version_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================================================
-- Jurisdictions (Federal and Minnesota)
-- ============================================================================

-- Federal jurisdiction
INSERT INTO jurisdiction (jurisdiction_id, jurisdiction_type, name, state_code, external_id, source_doc_id)
VALUES (
  '30000000-0000-0000-0001-000000000001',
  'federal',
  'United States Federal Government',
  'US',
  'US-FED-PAYROLL',
  '10000000-0000-0000-0001-000000000002'
)
ON CONFLICT (jurisdiction_id) DO UPDATE SET
  name = EXCLUDED.name;

-- Minnesota state jurisdiction
INSERT INTO jurisdiction (jurisdiction_id, jurisdiction_type, name, state_code, external_id, source_doc_id)
VALUES (
  '30000000-0000-0000-0001-000000000027',
  'state',
  'State of Minnesota',
  'MN',
  'MN-STATE-PAYROLL',
  '10000000-0000-0000-0001-000000000010'
)
ON CONFLICT (jurisdiction_id) DO UPDATE SET
  name = EXCLUDED.name;

-- ============================================================================
-- Federal Payroll Tax Instruments
-- ============================================================================

-- Social Security (OASDI) - Shared between employee and employer
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000001',
  '30000000-0000-0000-0001-000000000001',
  'payroll',
  'Social Security (OASDI)',
  'Old-Age, Survivors, and Disability Insurance tax under FICA. Split 50/50 between employee and employer.',
  true,
  '{
    "payroll_category": "social_security",
    "payer_type": "shared",
    "employee_share": 0.5,
    "employer_share": 0.5,
    "has_wage_cap": true,
    "display_order": 1,
    "employee_visible": true,
    "employer_visible": true,
    "microcopy": "Social Security tax funds retirement, disability, and survivor benefits. You and your employer each pay 6.2%."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000001'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Medicare (HI) - Shared between employee and employer
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000002',
  '30000000-0000-0000-0001-000000000001',
  'payroll',
  'Medicare (HI)',
  'Hospital Insurance tax under FICA. Split 50/50 between employee and employer. No wage cap.',
  true,
  '{
    "payroll_category": "medicare",
    "payer_type": "shared",
    "employee_share": 0.5,
    "employer_share": 0.5,
    "has_wage_cap": false,
    "display_order": 2,
    "employee_visible": true,
    "employer_visible": true,
    "microcopy": "Medicare tax funds hospital insurance. You and your employer each pay 1.45%, with no income limit."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000002'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Additional Medicare Tax - Employee only, above threshold
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000003',
  '30000000-0000-0000-0001-000000000001',
  'payroll',
  'Additional Medicare Tax',
  'Additional 0.9% Medicare tax on wages above threshold. Employee-only; no employer match.',
  true,
  '{
    "payroll_category": "medicare",
    "payer_type": "employee",
    "is_surtax": true,
    "has_threshold": true,
    "display_order": 3,
    "employee_visible": true,
    "employer_visible": false,
    "microcopy": "Additional Medicare Tax of 0.9% applies to wages above $200,000 (single filers). Your employer does not match this."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000002'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- FUTA - Employer only
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000004',
  '30000000-0000-0000-0001-000000000001',
  'payroll',
  'Federal Unemployment Tax (FUTA)',
  'Federal unemployment insurance tax. Employer-only; employees do not pay FUTA.',
  true,
  '{
    "payroll_category": "federal_unemployment",
    "payer_type": "employer",
    "has_wage_cap": true,
    "display_order": 4,
    "employee_visible": false,
    "employer_visible": true,
    "microcopy": "FUTA funds unemployment benefits. Your employer pays this tax; it is not deducted from your wages."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000003'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Minnesota State Payroll Tax Instruments
-- ============================================================================

-- Minnesota SUTA - Employer only
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000010',
  '30000000-0000-0000-0001-000000000027',
  'payroll',
  'Minnesota Unemployment Insurance (SUTA)',
  'State unemployment insurance tax. Employer-only; rate varies by experience rating.',
  true,
  '{
    "payroll_category": "state_unemployment",
    "payer_type": "employer",
    "has_wage_cap": true,
    "rate_varies": true,
    "display_order": 5,
    "employee_visible": false,
    "employer_visible": true,
    "microcopy": "Minnesota UI tax funds state unemployment benefits. Rate varies by employer experience (0.1% to 9%)."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000010'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Minnesota Paid Family & Medical Leave - Shared (effective 2026)
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000011',
  '30000000-0000-0000-0001-000000000027',
  'payroll',
  'Minnesota Paid Family & Medical Leave',
  'State paid leave program providing wage replacement. Premium collection begins 2025, benefits begin 2026.',
  true,
  '{
    "payroll_category": "paid_leave",
    "payer_type": "shared",
    "is_program_fee": true,
    "effective_year": 2026,
    "premium_collection_begins": 2025,
    "display_order": 6,
    "employee_visible": true,
    "employer_visible": true,
    "microcopy": "MN Paid Leave provides wage replacement for family and medical leave. Cost is shared between you and your employer."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000011'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Minnesota Workforce Development Fee - Employer only
INSERT INTO tax_instrument (tax_instrument_id, jurisdiction_id, tax_type, name, description, is_active, metadata, source_doc_id)
VALUES (
  '40000000-0000-0000-0001-000000000012',
  '30000000-0000-0000-0001-000000000027',
  'payroll',
  'Minnesota Workforce Development Fee',
  'State workforce development assessment. Employer-only; funds training programs.',
  true,
  '{
    "payroll_category": "workforce_fee",
    "payer_type": "employer",
    "is_program_fee": true,
    "has_wage_cap": true,
    "display_order": 7,
    "employee_visible": false,
    "employer_visible": true,
    "microcopy": "Funds Minnesota workforce training and development programs."
  }'::jsonb,
  '10000000-0000-0000-0001-000000000012'
)
ON CONFLICT (tax_instrument_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Social Security (2018-2025)
-- ============================================================================
-- DEMO DATA: Historical wage base limits (actual IRS values used for reference)

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employee_rate, employer_rate, self_employed_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES
  -- 2018: Wage base $128,400
  ('50000000-0000-0000-0001-000000000001',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'social_security', 'shared',
   0.062, 0.062, 0.124, 128400,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2019: Wage base $132,900
  ('50000000-0000-0000-0001-000000000002',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'social_security', 'shared',
   0.062, 0.062, 0.124, 132900,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2020: Wage base $137,700
  ('50000000-0000-0000-0001-000000000003',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'social_security', 'shared',
   0.062, 0.062, 0.124, 137700,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2021: Wage base $142,800
  ('50000000-0000-0000-0001-000000000004',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'social_security', 'shared',
   0.062, 0.062, 0.124, 142800,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2022: Wage base $147,000
  ('50000000-0000-0000-0001-000000000005',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'social_security', 'shared',
   0.062, 0.062, 0.124, 147000,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2023: Wage base $160,200
  ('50000000-0000-0000-0001-000000000006',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'social_security', 'shared',
   0.062, 0.062, 0.124, 160200,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2024: Wage base $168,600
  ('50000000-0000-0000-0001-000000000007',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'social_security', 'shared',
   0.062, 0.062, 0.124, 168600,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001'),

  -- 2025: Wage base $176,100 (projected)
  ('50000000-0000-0000-0001-000000000008',
   '40000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'social_security', 'shared',
   0.062, 0.062, 0.124, 176100,
   '{}'::jsonb,
   '{"display_name": "Social Security", "demo": true, "projected": true}'::jsonb,
   '10000000-0000-0000-0001-000000000001')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employee_rate = EXCLUDED.employee_rate,
  employer_rate = EXCLUDED.employer_rate,
  wage_base_limit = EXCLUDED.wage_base_limit,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Medicare (2018-2025)
-- ============================================================================
-- DEMO DATA: Medicare rate has been 1.45% each since 1986

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employee_rate, employer_rate, self_employed_rate,
  thresholds, metadata, source_doc_id
) VALUES
  -- 2018-2025: All same rate, no wage cap
  ('50000000-0000-0000-0002-000000000001',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000002',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000003',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000004',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000005',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000006',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000007',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0002-000000000008',
   '40000000-0000-0000-0001-000000000002', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'medicare', 'shared',
   0.0145, 0.0145, 0.029,
   '{}'::jsonb,
   '{"display_name": "Medicare", "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employee_rate = EXCLUDED.employee_rate,
  employer_rate = EXCLUDED.employer_rate,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Additional Medicare Tax (2018-2025)
-- ============================================================================
-- DEMO DATA: 0.9% on wages above threshold (employee-only)

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employee_rate, wage_floor,
  thresholds, metadata, source_doc_id
) VALUES
  -- 2018-2025: Same thresholds since 2013
  ('50000000-0000-0000-0003-000000000001',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000002',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000003',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000004',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000005',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000006',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000007',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002'),

  ('50000000-0000-0000-0003-000000000008',
   '40000000-0000-0000-0001-000000000003', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'medicare', 'employee',
   0.009, 200000,
   '{"single_threshold": 200000, "married_joint_threshold": 250000, "married_separate_threshold": 125000}'::jsonb,
   '{"display_name": "Additional Medicare", "is_surtax": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000002')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employee_rate = EXCLUDED.employee_rate,
  wage_floor = EXCLUDED.wage_floor,
  thresholds = EXCLUDED.thresholds,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: FUTA (2018-2025)
-- ============================================================================
-- DEMO DATA: 0.6% effective rate after state credit (on first $7,000)

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES
  -- 2018-2025: Same $7,000 wage base, 0.6% effective rate
  ('50000000-0000-0000-0004-000000000001',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000002',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000003',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000004',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000005',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000006',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000007',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003'),

  ('50000000-0000-0000-0004-000000000008',
   '40000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'federal_unemployment', 'employer',
   0.006, 7000,
   '{"gross_rate": 0.06, "state_credit_max": 0.054}'::jsonb,
   '{"display_name": "FUTA", "employer_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000003')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employer_rate = EXCLUDED.employer_rate,
  wage_base_limit = EXCLUDED.wage_base_limit,
  thresholds = EXCLUDED.thresholds,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Minnesota SUTA (2018-2025)
-- ============================================================================
-- DEMO DATA: New employer rate shown; actual rates vary by experience

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES
  -- Minnesota wage base changes over time
  ('50000000-0000-0000-0005-000000000001',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'state_unemployment', 'employer',
   0.01, 33000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000002',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'state_unemployment', 'employer',
   0.01, 34000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000003',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'state_unemployment', 'employer',
   0.01, 35000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000004',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'state_unemployment', 'employer',
   0.01, 36000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000005',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'state_unemployment', 'employer',
   0.01, 38000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000006',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'state_unemployment', 'employer',
   0.01, 40000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000007',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'state_unemployment', 'employer',
   0.01, 42000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010'),

  ('50000000-0000-0000-0005-000000000008',
   '40000000-0000-0000-0001-000000000010', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'state_unemployment', 'employer',
   0.01, 44000,
   '{"new_employer_rate": 0.01, "min_rate": 0.001, "max_rate": 0.09}'::jsonb,
   '{"display_name": "MN UI", "employer_only": true, "rate_varies": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000010')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employer_rate = EXCLUDED.employer_rate,
  wage_base_limit = EXCLUDED.wage_base_limit,
  thresholds = EXCLUDED.thresholds,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Minnesota Paid Leave (2025-2026)
-- ============================================================================
-- DEMO DATA: Premium collection begins 2025, benefits begin 2026

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employee_rate, employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES
  -- 2025: Premium collection begins (no data for 2018-2024)
  ('50000000-0000-0000-0006-000000000001',
   '40000000-0000-0000-0001-000000000011', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', '2025-12-31', 2025, 'paid_leave', 'shared',
   0.004, 0.003, 176100,
   '{"total_rate": 0.007, "employer_can_pay_all": true}'::jsonb,
   '{"display_name": "MN Paid Leave", "is_program_fee": true, "premium_only": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000011'),

  -- 2026: Benefits begin
  ('50000000-0000-0000-0006-000000000002',
   '40000000-0000-0000-0001-000000000011', '20000000-0000-0000-0001-000000000001',
   '2026-01-01', NULL, 2026, 'paid_leave', 'shared',
   0.004, 0.003, 180000,
   '{"total_rate": 0.007, "employer_can_pay_all": true}'::jsonb,
   '{"display_name": "MN Paid Leave", "is_program_fee": true, "benefits_available": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000011')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employee_rate = EXCLUDED.employee_rate,
  employer_rate = EXCLUDED.employer_rate,
  wage_base_limit = EXCLUDED.wage_base_limit,
  thresholds = EXCLUDED.thresholds,
  metadata = EXCLUDED.metadata;

-- ============================================================================
-- Payroll Tax Snapshots: Minnesota Workforce Development Fee (2018-2025)
-- ============================================================================
-- DEMO DATA: 0.1% (10 basis points) on taxable wages

INSERT INTO payroll_tax_snapshot (
  payroll_tax_snapshot_id, tax_instrument_id, methodology_version_id,
  effective_date, end_date, tax_year, payroll_category, payer_type,
  employer_rate, wage_base_limit,
  thresholds, metadata, source_doc_id
) VALUES
  -- Same rate structure, wage base follows SUTA
  ('50000000-0000-0000-0007-000000000001',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2018-01-01', '2018-12-31', 2018, 'workforce_fee', 'employer',
   0.001, 33000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000002',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2019-01-01', '2019-12-31', 2019, 'workforce_fee', 'employer',
   0.001, 34000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000003',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2020-01-01', '2020-12-31', 2020, 'workforce_fee', 'employer',
   0.001, 35000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000004',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2021-01-01', '2021-12-31', 2021, 'workforce_fee', 'employer',
   0.001, 36000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000005',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2022-01-01', '2022-12-31', 2022, 'workforce_fee', 'employer',
   0.001, 38000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000006',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2023-01-01', '2023-12-31', 2023, 'workforce_fee', 'employer',
   0.001, 40000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000007',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2024-01-01', '2024-12-31', 2024, 'workforce_fee', 'employer',
   0.001, 42000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012'),

  ('50000000-0000-0000-0007-000000000008',
   '40000000-0000-0000-0001-000000000012', '20000000-0000-0000-0001-000000000001',
   '2025-01-01', NULL, 2025, 'workforce_fee', 'employer',
   0.001, 44000,
   '{}'::jsonb,
   '{"display_name": "MN Workforce Fee", "employer_only": true, "is_program_fee": true, "demo": true}'::jsonb,
   '10000000-0000-0000-0001-000000000012')

ON CONFLICT (tax_instrument_id, methodology_version_id, effective_date, payroll_category)
DO UPDATE SET
  employer_rate = EXCLUDED.employer_rate,
  wage_base_limit = EXCLUDED.wage_base_limit,
  metadata = EXCLUDED.metadata;

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the seed data was loaded correctly:
--
-- SELECT
--   ti.name AS instrument,
--   pts.tax_year,
--   pts.payroll_category,
--   pts.payer_type,
--   pts.employee_rate,
--   pts.employer_rate,
--   pts.wage_base_limit,
--   sd.is_demo,
--   sd.title
-- FROM payroll_tax_snapshot pts
-- JOIN tax_instrument ti ON pts.tax_instrument_id = ti.tax_instrument_id
-- JOIN source_doc sd ON pts.source_doc_id = sd.source_doc_id
-- WHERE sd.is_demo = true
-- ORDER BY ti.name, pts.tax_year;
