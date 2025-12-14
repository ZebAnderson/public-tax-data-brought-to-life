/**
 * TaxAtlas API Response DTOs
 * These types define the shape of API responses.
 * Frontend consumes these; backend produces these.
 */

import type {
  GeoUnitType,
  JurisdictionType,
  TaxType,
  DecisionEventType,
  ImpactDirection,
  VoteValue,
  PolicySignalStatus,
  PresenceMode,
  ProfileType,
  PayrollCategory,
  PayrollPayer,
} from './database';

// ============================================================================
// Common Types
// ============================================================================

/** Data confidence level for trust UX */
export type DataType = 'fact' | 'estimate' | 'signal';

/** Confidence in place resolution */
export type ResolutionConfidence = 'high' | 'medium' | 'low';

/** Source reference - every number should have one */
export interface SourceReference {
  sourceId: string;
  url: string;
  title: string | null;
  retrievedAt: string | null;
  publishedAt: string | null;
  isDemo: boolean;
}

/** Bounding box [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

/** GeoJSON Point */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// ============================================================================
// Payroll Tax Types
// ============================================================================

/** Individual payroll tax line item */
export interface PayrollTaxLineItem {
  instrumentId: string;
  instrumentName: string;
  category: PayrollCategory;
  payer: PayrollPayer;
  amount: number;
  rate: number;
  wageBase: number | null;
  threshold: number | null;
  dataType: DataType;
  source: SourceReference;
  /** Display label for UI (e.g., "Social Security (Employee)") */
  label: string;
  note: string | null;
  /** Microcopy for UI education */
  microcopy: string | null;
}

/** Payroll tax breakdown for burden estimate */
export interface PayrollBreakdown {
  /** Taxes withheld from employee wages (visible on pay stub) */
  employeePaid: {
    items: PayrollTaxLineItem[];
    total: number;
  };
  /** Taxes paid by employer (hidden from pay stub) */
  employerPaid: {
    items: PayrollTaxLineItem[];
    total: number;
  };
  /** State/local program fees (may be split) */
  programFees: {
    items: PayrollTaxLineItem[];
    total: number;
  };
  /** Combined totals */
  totalEmployeePaid: number;
  totalEmployerPaid: number;
  totalPayroll: number;
  /** Input assumptions used for calculation */
  assumptions: {
    profileType: ProfileType;
    wagesAnnual: number;
    showEmployerSide: boolean;
  };
  /** Data quality indicator */
  dataType: DataType;
  /** Computation notes and warnings */
  notes?: string[];
}

/** User income profile for payroll calculations */
export interface IncomeProfile {
  profileType: ProfileType;
  wagesAnnual: number | null;
  contractorIncomeAnnual: number | null;
  householdIncomeAnnual: number | null;
  householdSize: number | null;
  showEmployerSide: boolean;
  spendingAnnualTaxable: number | null;
}

// ============================================================================
// GET /api/resolve
// ============================================================================

export interface ResolveRequest {
  q: string;
  state?: string;
  city?: string;
}

export interface ResolvedPlace {
  geoUnitId: string;
  geoUnitType: GeoUnitType;
  name: string;
  displayName: string;
  stateCode: string;
  countyFips: string | null;
  matchedAlias: string;
  aliasKind: string;
  isPreferred: boolean;
}

export interface ResolveResponse {
  query: string;
  confidence: ResolutionConfidence;
  results: ResolvedPlace[];
  bbox: BBox | null;
  centroid: GeoPoint | null;
  /** If low confidence, provide disambiguation options */
  disambiguation: ResolvedPlace[] | null;
}

// ============================================================================
// GET /api/place/:geoUnitId/summary
// ============================================================================

export interface SummaryRequest {
  year?: number;
  mode?: PresenceMode;
}

export interface JurisdictionSummary {
  jurisdictionId: string;
  jurisdictionType: JurisdictionType;
  name: string;
  coverageRatio: number;
}

export interface TaxCardSummary {
  taxType: TaxType;
  totalRate: number | null;
  rateUnit: string;
  dataType: DataType;
  jurisdictionCount: number;
  source: SourceReference;
  note: string | null;
}

export interface TaxBurdenSummary {
  taxYear: number;
  presenceMode: PresenceMode;
  currencyCode: string;
  totalAmount: number;
  components: {
    taxType: TaxType;
    amount: number;
    percentage: number;
  }[];
  /** Payroll breakdown (only present when profile includes W-2 income) */
  payrollBreakdown: PayrollBreakdown | null;
  dataType: DataType;
  source: SourceReference;
}

export interface PlaceSummaryResponse {
  geoUnitId: string;
  name: string;
  displayName: string;
  geoUnitType: GeoUnitType;
  stateCode: string;
  confidence: ResolutionConfidence;
  isDemo: boolean;

  /** Tax year for the data */
  taxYear: number;
  presenceMode: PresenceMode;

  /** Jurisdictions that apply to this place */
  jurisdictions: JurisdictionSummary[];

  /** Tax cards for dashboard */
  taxCards: TaxCardSummary[];

  /** Total burden estimate (if available) */
  burdenEstimate: TaxBurdenSummary | null;

  /** Bounding box and centroid */
  bbox: BBox | null;
  centroid: GeoPoint | null;
}

// ============================================================================
// GET /api/place/:geoUnitId/taxes
// ============================================================================

export interface TaxesRequest {
  type?: TaxType;
  from?: number;
  to?: number;
}

export interface TaxRateBracket {
  min: number;
  max: number | null;
  rate: number;
  label?: string;
}

export interface TaxRateDataPoint {
  year: number;
  effectiveDate: string;
  rateValue: number | null;
  rateBrackets: TaxRateBracket[] | null;
  rateUnit: string;
  dataType: DataType;
  source: SourceReference;
}

export interface JurisdictionTaxDetail {
  jurisdictionId: string;
  jurisdictionType: JurisdictionType;
  jurisdictionName: string;
  instrumentId: string;
  instrumentName: string;
  coverageRatio: number;
  currentRate: number | null;
  rateUnit: string;
  dataType: DataType;
  source: SourceReference;
  note: string | null;
  /** Time series data */
  timeSeries: TaxRateDataPoint[];
}

export interface PropertyTaxContext {
  taxYear: number;
  levyAmount: number | null;
  taxableValueAmount: number | null;
  medianBillAmount: number | null;
  billP25Amount: number | null;
  billP75Amount: number | null;
  parcelCount: number | null;
  householdCount: number | null;
  dataType: DataType;
  source: SourceReference;
}

export interface TaxCategoryDetail {
  taxType: TaxType;
  displayName: string;
  /** Combined rate across all jurisdictions */
  totalRate: number | null;
  rateUnit: string;
  dataType: DataType;
  /** Breakdown by jurisdiction */
  jurisdictions: JurisdictionTaxDetail[];
  /** Property tax specific context */
  propertyContext: PropertyTaxContext[] | null;
  /** Combined time series for trend chart */
  trendData: {
    year: number;
    totalRate: number;
  }[];
  /** Change over the period */
  changePercent: number | null;
  changeDirection: 'up' | 'down' | 'stable' | null;
}

export interface TaxesResponse {
  geoUnitId: string;
  name: string;
  taxYear: number;
  presenceMode: PresenceMode;
  isDemo: boolean;

  /** Tax categories requested */
  categories: TaxCategoryDetail[];

  /** Methodology version used */
  methodologyVersion: string;
}

// ============================================================================
// GET /api/place/:geoUnitId/accountability
// ============================================================================

export interface AccountabilityRequest {
  taxType?: TaxType;
  from?: number;
  to?: number;
}

export interface OfficialVote {
  personId: string;
  fullName: string;
  officeId: string;
  officeName: string;
  voteValue: VoteValue;
  weight: number;
}

export interface VoteRecordDetail {
  voteRecordId: string;
  voteType: 'roll_call' | 'ballot_measure' | 'referendum' | 'other';
  voteDate: string;
  question: string | null;
  passed: boolean | null;
  yesCount: number | null;
  noCount: number | null;
  abstainCount: number | null;
  absentCount: number | null;
  /** Individual votes (for roll call) */
  votes: OfficialVote[];
  source: SourceReference;
}

export interface TaxImpactDetail {
  taxInstrumentId: string;
  taxType: TaxType;
  instrumentName: string;
  impactDirection: ImpactDirection;
  taxYear: number | null;
  deltaRateValue: number | null;
  deltaRevenueAmount: number | null;
  deltaDescription: string | null;
  source: SourceReference;
}

export interface OfficialAtEvent {
  personId: string;
  fullName: string;
  officeId: string;
  officeName: string;
  termStart: string;
  termEnd: string | null;
}

export interface DecisionEventDetail {
  decisionEventId: string;
  eventType: DecisionEventType;
  eventDate: string;
  effectiveDate: string | null;
  title: string;
  summary: string | null;
  jurisdictionId: string;
  jurisdictionType: JurisdictionType;
  jurisdictionName: string;
  dataType: DataType;
  source: SourceReference;

  /** Tax impacts from this decision */
  impacts: TaxImpactDetail[];

  /** Vote records (may be multiple per decision) */
  voteRecords: VoteRecordDetail[];

  /** Officials in office at time of decision */
  officialsAtEvent: OfficialAtEvent[];
}

export interface AccountabilityResponse {
  geoUnitId: string;
  name: string;
  isDemo: boolean;

  /** Filter applied */
  filters: {
    taxType: TaxType | null;
    fromYear: number;
    toYear: number;
  };

  /** Timeline of events, most recent first */
  events: DecisionEventDetail[];

  /** Total count (for pagination if needed) */
  totalCount: number;
}

// ============================================================================
// GET /api/place/:geoUnitId/pending
// ============================================================================

export interface PolicySignalDetail {
  policySignalId: string;
  status: PolicySignalStatus;
  signalDate: string;
  title: string;
  summary: string | null;
  jurisdictionId: string;
  jurisdictionType: JurisdictionType;
  jurisdictionName: string;
  taxType: TaxType | null;
  taxInstrumentId: string | null;
  instrumentName: string | null;
  /** Structured details (type-specific) */
  details: {
    type: 'proposed_budget' | 'pending_legislation' | 'ballot_measure' | 'referendum' | 'other';
    potentialImpact?: string;
    deadline?: string;
    phase?: string;
    billNumber?: string;
    electionDate?: string;
  };
  dataType: 'signal'; // Always signal for pending items
  source: SourceReference;
}

export interface PendingResponse {
  geoUnitId: string;
  name: string;
  isDemo: boolean;

  /** When we last checked for updates */
  lastChecked: string;

  /** Pending items, sorted by relevance/deadline */
  items: PolicySignalDetail[];

  /** Disclaimer text (frontend should display prominently) */
  disclaimer: string;
}

// ============================================================================
// GET /api/person/:id
// ============================================================================

export interface TermDetail {
  termId: string;
  officeId: string;
  officeName: string;
  jurisdictionId: string;
  jurisdictionName: string;
  jurisdictionType: JurisdictionType;
  startDate: string;
  endDate: string | null;
  electedDate: string | null;
  party: string | null;
  isCurrent: boolean;
}

export interface VoteFootprintSummary {
  taxType: TaxType;
  /** Count of votes where impact was increase */
  votedForIncrease: number;
  /** Count of votes where impact was decrease */
  votedForDecrease: number;
  /** Count of votes against increase */
  votedAgainstIncrease: number;
  /** Count of votes against decrease */
  votedAgainstDecrease: number;
  /** Total votes on this tax type */
  totalVotes: number;
}

export interface RecentVoteActivity {
  decisionEventId: string;
  eventDate: string;
  title: string;
  jurisdictionName: string;
  taxType: TaxType;
  impactDirection: ImpactDirection;
  voteValue: VoteValue;
  passed: boolean | null;
  source: SourceReference;
}

export interface PersonResponse {
  personId: string;
  fullName: string;
  givenName: string | null;
  familyName: string | null;
  isDemo: boolean;

  /** All terms held */
  terms: TermDetail[];

  /** Current offices (subset of terms) */
  currentOffices: TermDetail[];

  /** Vote footprint by tax type (fact-only, computed from votes) */
  voteFootprint: VoteFootprintSummary[];

  /** Recent vote activity (last 10) */
  recentVotes: RecentVoteActivity[];

  source: SourceReference;
}

// ============================================================================
// Error Response
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}
