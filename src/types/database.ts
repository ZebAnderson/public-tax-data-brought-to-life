/**
 * TaxAtlas Database Types
 * Generated from PostgreSQL schema - db/migrations/0001_taxatlas_schema.sql
 */

// ============================================================================
// Enums (matching PostgreSQL ENUMs)
// ============================================================================

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

export type DecisionEventType =
  | 'budget'
  | 'levy'
  | 'rate_change'
  | 'referendum'
  | 'statute'
  | 'ordinance'
  | 'other';

export type ImpactDirection =
  | 'increase'
  | 'decrease'
  | 'no_change'
  | 'restructure'
  | 'unknown';

export type VoteRecordType =
  | 'roll_call'
  | 'ballot_measure'
  | 'referendum'
  | 'other';

export type VoteValue =
  | 'yes'
  | 'no'
  | 'abstain'
  | 'absent'
  | 'present'
  | 'other';

export type PolicySignalStatus =
  | 'proposed'
  | 'pending'
  | 'enacted'
  | 'withdrawn'
  | 'expired'
  | 'unknown';

export type DataKind = 'fact' | 'estimate' | 'signal';

export type PresenceMode = 'live' | 'work' | 'live_work';

// New enums for payroll and assumptions (migration 0003)
export type ProfileType =
  | 'w2'
  | 'contractor_1099'
  | 'self_employed'
  | 'mixed'
  | 'unsure';

export type PayrollCategory =
  | 'social_security'
  | 'medicare'
  | 'federal_unemployment'
  | 'state_unemployment'
  | 'state_disability'
  | 'paid_leave'
  | 'workforce_fee'
  | 'local_payroll'
  | 'other';

export type PayrollPayer =
  | 'employee'
  | 'employer'
  | 'shared'
  | 'self_employed';

// ============================================================================
// Core Tables
// ============================================================================

export interface MethodologyVersion {
  methodology_version_id: string;
  kind: DataKind;
  name: string;
  version: string;
  description: string | null;
  created_at: Date;
}

export interface SourceDoc {
  source_doc_id: string;
  url: string;
  content_sha256: string;
  is_demo: boolean;
  retrieved_at: Date | null;
  published_at: Date | null;
  title: string | null;
  mime_type: string | null;
  notes: string | null;
  created_at: Date;
}

export interface GeoUnit {
  geo_unit_id: string;
  geo_unit_type: GeoUnitType;
  geoid: string;
  name: string;
  country_code: string;
  state_code: string;
  state_fips: string | null;
  county_fips: string | null;
  // geom and centroid are PostGIS types - represented as GeoJSON in API
  source_doc_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlaceAlias {
  place_alias_id: number;
  alias_text: string;
  state_code: string;
  geo_unit_id: string;
  alias_kind: string;
  alias_rank: number;
  is_preferred: boolean;
  source_doc_id: string;
  created_at: Date;
}

export interface Jurisdiction {
  jurisdiction_id: string;
  jurisdiction_type: JurisdictionType;
  name: string;
  country_code: string;
  state_code: string;
  external_id: string | null;
  parent_jurisdiction_id: string | null;
  source_doc_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface GeoUnitJurisdiction {
  geo_unit_id: string;
  jurisdiction_id: string;
  methodology_version_id: string;
  coverage_ratio: number;
  coverage_area_m2: number | null;
  notes: string | null;
  source_doc_id: string;
  created_at: Date;
}

export interface TaxInstrument {
  tax_instrument_id: string;
  jurisdiction_id: string;
  tax_type: TaxType;
  name: string;
  description: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface TaxRateSnapshot {
  tax_rate_snapshot_id: string;
  tax_instrument_id: string;
  methodology_version_id: string;
  effective_date: Date;
  end_date: Date | null;
  tax_year: number | null;
  rate_value: number | null;
  rate_unit: string;
  rate_brackets: unknown | null;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface PropertyTaxContextSnapshot {
  property_tax_context_snapshot_id: string;
  tax_instrument_id: string;
  geo_unit_id: string;
  methodology_version_id: string;
  tax_year: number;
  levy_amount: number | null;
  taxable_value_amount: number | null;
  tax_capacity_amount: number | null;
  median_bill_amount: number | null;
  bill_p25_amount: number | null;
  bill_p75_amount: number | null;
  parcel_count: number | null;
  household_count: number | null;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface TaxBurdenEstimate {
  tax_burden_estimate_id: string;
  geo_unit_id: string;
  methodology_version_id: string;
  tax_year: number;
  presence_mode: PresenceMode;
  currency_code: string;
  scenario: Record<string, unknown>;
  total_amount: number;
  components: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface DecisionEvent {
  decision_event_id: string;
  jurisdiction_id: string;
  event_type: DecisionEventType;
  event_date: Date;
  effective_date: Date | null;
  title: string;
  summary: string | null;
  details: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface DecisionTaxImpact {
  decision_tax_impact_id: string;
  decision_event_id: string;
  tax_instrument_id: string;
  methodology_version_id: string;
  impact_direction: ImpactDirection;
  tax_year: number | null;
  delta_rate_value: number | null;
  delta_revenue_amount: number | null;
  delta_description: string | null;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface Person {
  person_id: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  external_ids: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Office {
  office_id: string;
  jurisdiction_id: string;
  office_name: string;
  office_category: string | null;
  district_geo_unit_id: string | null;
  seats_count: number | null;
  source_doc_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Term {
  term_id: string;
  person_id: string;
  office_id: string;
  start_date: Date;
  end_date: Date | null;
  elected_date: Date | null;
  party: string | null;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface VoteRecord {
  vote_record_id: string;
  decision_event_id: string;
  jurisdiction_id: string;
  vote_type: VoteRecordType;
  vote_date: Date;
  question: string | null;
  passed: boolean | null;
  yes_count: number | null;
  no_count: number | null;
  abstain_count: number | null;
  absent_count: number | null;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

export interface VoteCast {
  vote_cast_id: string;
  vote_record_id: string;
  voter_person_id: string | null;
  voter_geo_unit_id: string | null;
  vote_value: VoteValue;
  weight: number;
  notes: string | null;
  source_doc_id: string;
  created_at: Date;
}

export interface PolicySignal {
  policy_signal_id: string;
  jurisdiction_id: string;
  tax_instrument_id: string | null;
  tax_type: TaxType | null;
  status: PolicySignalStatus;
  signal_date: Date;
  title: string;
  summary: string | null;
  details: Record<string, unknown>;
  methodology_version_id: string;
  source_doc_id: string;
  created_at: Date;
}

// ============================================================================
// Assumption Profile (Migration 0003)
// ============================================================================

export interface AssumptionProfile {
  assumption_profile_id: string;
  session_id: string;
  geo_unit_id: string | null;
  profile_type: ProfileType;
  wages_annual: number | null;
  contractor_income_annual: number | null;
  household_income_annual: number | null;
  show_employer_side: boolean;
  spending_annual_taxable: number | null;
  household_size: number | null;
  methodology_version: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

// ============================================================================
// Payroll Tax Snapshot (Migration 0003)
// ============================================================================

export interface PayrollTaxSnapshot {
  payroll_tax_snapshot_id: string;
  tax_instrument_id: string;
  methodology_version_id: string;
  effective_date: Date;
  end_date: Date | null;
  tax_year: number;
  payroll_category: PayrollCategory;
  payer_type: PayrollPayer;
  employee_rate: number | null;
  employer_rate: number | null;
  self_employed_rate: number | null;
  wage_base_limit: number | null;
  wage_floor: number | null;
  thresholds: Record<string, unknown>;
  metadata: Record<string, unknown>;
  source_doc_id: string;
  created_at: Date;
}

// ============================================================================
// Payroll Components Structure (for tax_burden_estimate.components)
// ============================================================================

export interface PayrollTaxItem {
  amount: number;
  rate: number;
  wageBase?: number;
  threshold?: number;
  source?: string;
}

export interface PayrollComponents {
  employeePaid: {
    socialSecurity?: PayrollTaxItem;
    medicare?: PayrollTaxItem;
    additionalMedicare?: PayrollTaxItem;
    stateDisability?: PayrollTaxItem;
    paidLeave?: PayrollTaxItem;
    [key: string]: PayrollTaxItem | undefined;
  };
  employerPaid: {
    socialSecurity?: PayrollTaxItem;
    medicare?: PayrollTaxItem;
    futa?: PayrollTaxItem;
    suta?: PayrollTaxItem;
    paidLeave?: PayrollTaxItem;
    workforceFee?: PayrollTaxItem;
    [key: string]: PayrollTaxItem | undefined;
  };
  programFees?: {
    [key: string]: PayrollTaxItem;
  };
  totalEmployeePaid: number;
  totalEmployerPaid: number;
  totalPayroll: number;
}
