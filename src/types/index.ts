/**
 * TaxAtlas Frontend Types
 * Re-exports API types and adds frontend-specific types
 */

// Re-export all API types
export type {
  // Common
  DataType,
  ResolutionConfidence,
  SourceReference,
  BBox,
  GeoPoint,

  // Resolve
  ResolveRequest,
  ResolvedPlace,
  ResolveResponse,

  // Summary
  SummaryRequest,
  JurisdictionSummary,
  TaxCardSummary,
  TaxBurdenSummary,
  PlaceSummaryResponse,

  // Taxes
  TaxesRequest,
  TaxRateBracket,
  TaxRateDataPoint,
  JurisdictionTaxDetail,
  PropertyTaxContext,
  TaxCategoryDetail,
  TaxesResponse,

  // Accountability
  AccountabilityRequest,
  OfficialVote,
  VoteRecordDetail,
  TaxImpactDetail,
  OfficialAtEvent,
  DecisionEventDetail,
  AccountabilityResponse,

  // Pending
  PolicySignalDetail,
  PendingResponse,

  // Person
  TermDetail,
  VoteFootprintSummary,
  RecentVoteActivity,
  PersonResponse,

  // Error
  ApiError,
} from './api';

// Re-export database enums
export type {
  GeoUnitType,
  JurisdictionType,
  TaxType,
  DecisionEventType,
  ImpactDirection,
  VoteValue,
  PolicySignalStatus,
  PresenceMode,
  // New payroll types
  ProfileType,
  PayrollCategory,
  PayrollPayer,
  PayrollComponents,
  PayrollTaxItem,
} from './database';

// Re-export payroll API types
export type {
  PayrollTaxLineItem,
  PayrollBreakdown,
  IncomeProfile,
} from './api';

// ============================================================================
// Frontend-Specific Types
// ============================================================================

/** Presence mode options for UI */
export type PresenceModeOption = 'live' | 'work' | 'both';

/** Map to API presence mode */
export const presenceModeMap: Record<PresenceModeOption, string> = {
  live: 'live',
  work: 'work',
  both: 'live_work',
};

// ============================================================================
// User Assumptions (Frontend-Only)
// ============================================================================

export type PayType = 'w2' | 'contractor_1099' | 'self_employed' | 'mixed_unsure';

/** Search result item for autocomplete */
export interface SearchResultItem {
  geoUnitId: string;
  label: string;
  sublabel: string;
  geoUnitType: string;
}

/** Filter state for accountability timeline */
export interface AccountabilityFilters {
  taxType: string | null;
  fromYear: number;
  toYear: number;
  /** Filter events by jurisdiction type (level of governance) */
  jurisdictionType: import('./database').JurisdictionType | null;
  /** Highlight/filter by a specific elected official */
  officialPersonId: string | null;
  /** Filter events by tax impact direction */
  impactDirection: 'all' | 'increase' | 'decrease';
}

export interface UserAssumptions {
  payType: PayType;
  annualW2WageIncome: number | null;
  annual1099Income: number | null;
  annualHouseholdIncome: number | null;
  householdSize: number | null;
  showEmployerSideTaxes: boolean;
  annualTaxableSpending: number | null;
}

/** Tab keys for dashboard */
export type DashboardTab = 'taxes' | 'accountability' | 'pending' | 'methodology';

/** Source drawer state */
export interface SourceDrawerState {
  isOpen: boolean;
  source: import('./api').SourceReference | null;
}

/** App configuration */
export interface AppConfig {
  useMockData: boolean;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}
