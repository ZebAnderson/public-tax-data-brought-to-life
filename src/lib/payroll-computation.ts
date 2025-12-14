/**
 * TaxAtlas Payroll Tax Computation
 * Pure functions for computing payroll tax breakdown from snapshots
 *
 * Methodology v1:
 * - Read latest effective snapshot for each payroll instrument
 * - Apply rate to wage base (handle caps/thresholds from snapshot JSON)
 * - Split into employee vs employer sides based on snapshot metadata
 * - If missing snapshots or source, return amounts as "estimate_unavailable"
 */

import type {
  ProfileType,
  PayrollCategory,
  PayrollPayer,
  SourceReference,
  DataType,
} from '../types';

// ============================================================================
// Input Types
// ============================================================================

/** Payroll tax snapshot data from database */
export interface PayrollSnapshotInput {
  payrollTaxSnapshotId: string;
  taxInstrumentId: string;
  instrumentName: string;
  jurisdictionName: string;
  jurisdictionType: string;
  payrollCategory: PayrollCategory;
  payerType: PayrollPayer;
  taxYear: number;
  employeeRate: number | null;
  employerRate: number | null;
  selfEmployedRate: number | null;
  wageBaseLimit: number | null;
  wageFloor: number | null;
  thresholds: PayrollThresholds;
  metadata: PayrollMetadata;
  sourceDocId: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceRetrievedAt: Date | null;
  sourcePublishedAt: string | null;
  isDemo: boolean;
}

/** Threshold configuration in snapshot JSON */
export interface PayrollThresholds {
  additionalMedicareThreshold?: number;
  additionalMedicareRate?: number;
  singleThreshold?: number;
  marriedJointThreshold?: number;
  marriedSeparateThreshold?: number;
  grossRate?: number;
  stateCreditMax?: number;
  effectiveRateWithCredit?: number;
  [key: string]: number | undefined;
}

/** Metadata configuration in snapshot JSON */
export interface PayrollMetadata {
  displayName?: string;
  shortName?: string;
  appliesTo?: ProfileType[];
  employeeVisible?: boolean;
  employerVisible?: boolean;
  notes?: string;
  microcopy?: string;
  isProgramFee?: boolean;
  [key: string]: unknown;
}

/** Input parameters for payroll computation */
export interface PayrollComputationInput {
  /** Annual W-2 wages */
  wagesAnnual: number;
  /** Tax year for computation */
  taxYear: number;
  /** Profile type */
  profileType: ProfileType;
  /** Whether to include employer-side taxes */
  showEmployerSide: boolean;
  /** Annual 1099 contractor income (for self-employment tax) */
  contractorIncomeAnnual?: number;
  /** Payroll tax snapshots from database */
  snapshots: PayrollSnapshotInput[];
}

// ============================================================================
// Output Types
// ============================================================================

/** Individual payroll tax line item result */
export interface PayrollLineItem {
  instrumentId: string;
  instrumentName: string;
  category: PayrollCategory;
  payer: PayrollPayer;
  amount: number;
  rate: number;
  taxableWages: number;
  wageBase: number | null;
  threshold: number | null;
  dataType: DataType;
  source: SourceReference;
  label: string;
  note: string | null;
  microcopy: string | null;
  /** If computation failed, reason why */
  unavailableReason?: string;
}

/** Result of payroll computation */
export interface PayrollComputationResult {
  enabled: boolean;
  profileType: ProfileType;
  inputs: {
    wagesAnnual: number;
    contractorIncomeAnnual?: number;
    showEmployerSide: boolean;
  };
  employeePaid: PayrollLineItem[];
  employerPaid: PayrollLineItem[];
  programFees: PayrollLineItem[];
  totals: {
    employeePaidTotal: number;
    employerPaidTotal: number;
    programFeesTotal: number;
    combinedTotal: number;
  };
  dataType: DataType;
  /** Warnings or notes about the computation */
  notes: string[];
}

// ============================================================================
// Pure Computation Functions
// ============================================================================

/**
 * Build source reference from snapshot data
 */
function buildSource(snapshot: PayrollSnapshotInput): SourceReference {
  return {
    sourceId: snapshot.sourceDocId,
    url: snapshot.sourceUrl,
    title: snapshot.sourceTitle,
    retrievedAt: snapshot.sourceRetrievedAt?.toISOString() ?? null,
    publishedAt: snapshot.sourcePublishedAt,
    isDemo: snapshot.isDemo,
  };
}

/**
 * Determine if a snapshot applies to the given profile type
 */
function appliesToProfile(snapshot: PayrollSnapshotInput, profileType: ProfileType): boolean {
  const appliesTo = snapshot.metadata.appliesTo;
  if (!appliesTo || appliesTo.length === 0) {
    // Default: W-2 and self-employed get all payroll taxes
    return profileType === 'w2' || profileType === 'self_employed' || profileType === 'mixed';
  }
  return appliesTo.includes(profileType);
}

/**
 * Compute taxable wages after applying wage base limit
 */
function computeTaxableWages(wages: number, wageBaseLimit: number | null): number {
  if (wageBaseLimit === null) {
    return wages;
  }
  return Math.min(wages, wageBaseLimit);
}

/**
 * Compute tax amount for a single snapshot
 */
function computeTaxAmount(
  wages: number,
  rate: number | null,
  wageBaseLimit: number | null,
  wageFloor: number | null
): { amount: number; taxableWages: number } {
  if (rate === null) {
    return { amount: 0, taxableWages: 0 };
  }

  // Check wage floor (minimum wages before tax applies)
  if (wageFloor !== null && wages < wageFloor) {
    return { amount: 0, taxableWages: 0 };
  }

  const taxableWages = computeTaxableWages(wages, wageBaseLimit);
  const amount = Math.round(taxableWages * rate * 100) / 100; // Round to cents

  return { amount, taxableWages };
}

/**
 * Compute Additional Medicare Tax (surtax above threshold)
 * This is special because it only applies to wages above a threshold
 */
function computeAdditionalMedicareTax(
  wages: number,
  snapshot: PayrollSnapshotInput
): { amount: number; taxableWages: number } {
  const rate = snapshot.employeeRate;
  const threshold = snapshot.wageFloor ?? snapshot.thresholds.singleThreshold ?? 200000;

  if (rate === null || wages <= threshold) {
    return { amount: 0, taxableWages: 0 };
  }

  const taxableWages = wages - threshold;
  const amount = Math.round(taxableWages * rate * 100) / 100;

  return { amount, taxableWages };
}

/**
 * Process a single snapshot into employee and/or employer line items
 */
function processSnapshot(
  snapshot: PayrollSnapshotInput,
  wages: number,
  profileType: ProfileType
): { employeeItem?: PayrollLineItem; employerItem?: PayrollLineItem } {
  const result: { employeeItem?: PayrollLineItem; employerItem?: PayrollLineItem } = {};

  // Check if this applies to the profile
  if (!appliesToProfile(snapshot, profileType)) {
    return result;
  }

  const source = buildSource(snapshot);
  const label = snapshot.metadata.displayName || snapshot.instrumentName;
  const microcopy = snapshot.metadata.microcopy || null;
  const note = snapshot.metadata.notes || null;
  const isProgramFee = snapshot.metadata.isProgramFee || false;

  // Determine data type
  const dataType: DataType = snapshot.isDemo ? 'estimate' : 'fact';

  // Special handling for Additional Medicare Tax
  const isAdditionalMedicare = snapshot.instrumentName.toLowerCase().includes('additional medicare');

  // Process employee portion
  if (snapshot.employeeRate !== null) {
    const { amount, taxableWages } = isAdditionalMedicare
      ? computeAdditionalMedicareTax(wages, snapshot)
      : computeTaxAmount(wages, snapshot.employeeRate, snapshot.wageBaseLimit, snapshot.wageFloor);

    if (amount > 0 || !isAdditionalMedicare) {
      result.employeeItem = {
        instrumentId: snapshot.taxInstrumentId,
        instrumentName: snapshot.instrumentName,
        category: snapshot.payrollCategory,
        payer: 'employee',
        amount,
        rate: snapshot.employeeRate,
        taxableWages,
        wageBase: snapshot.wageBaseLimit,
        threshold: isAdditionalMedicare ? (snapshot.wageFloor ?? snapshot.thresholds.singleThreshold ?? null) : null,
        dataType,
        source,
        label: `${label} (Employee)`,
        note,
        microcopy,
      };
    }
  }

  // Process employer portion (not for Additional Medicare Tax)
  if (snapshot.employerRate !== null && !isAdditionalMedicare) {
    const { amount, taxableWages } = computeTaxAmount(
      wages,
      snapshot.employerRate,
      snapshot.wageBaseLimit,
      snapshot.wageFloor
    );

    result.employerItem = {
      instrumentId: snapshot.taxInstrumentId,
      instrumentName: snapshot.instrumentName,
      category: snapshot.payrollCategory,
      payer: 'employer',
      amount,
      rate: snapshot.employerRate,
      taxableWages,
      wageBase: snapshot.wageBaseLimit,
      threshold: null,
      dataType,
      source,
      label: `${label} (Employer)`,
      note,
      microcopy,
    };
  }

  return result;
}

/**
 * Main computation function - PURE FUNCTION
 * Computes payroll tax breakdown from input parameters and snapshots
 */
export function computePayrollBreakdown(input: PayrollComputationInput): PayrollComputationResult {
  const {
    wagesAnnual,
    taxYear,
    profileType,
    showEmployerSide,
    contractorIncomeAnnual,
    snapshots,
  } = input;

  const notes: string[] = [];
  const employeePaid: PayrollLineItem[] = [];
  const employerPaid: PayrollLineItem[] = [];
  const programFees: PayrollLineItem[] = [];

  // Check if payroll taxes are applicable
  if (profileType === 'contractor_1099') {
    // 1099 contractors don't have traditional payroll taxes
    // They pay self-employment tax instead
    notes.push('1099 contractors pay self-employment tax instead of traditional payroll taxes.');
    return {
      enabled: false,
      profileType,
      inputs: { wagesAnnual, contractorIncomeAnnual, showEmployerSide },
      employeePaid: [],
      employerPaid: [],
      programFees: [],
      totals: {
        employeePaidTotal: 0,
        employerPaidTotal: 0,
        programFeesTotal: 0,
        combinedTotal: 0,
      },
      dataType: 'estimate',
      notes,
    };
  }

  if (wagesAnnual <= 0) {
    notes.push('No W-2 wages provided.');
    return {
      enabled: false,
      profileType,
      inputs: { wagesAnnual, contractorIncomeAnnual, showEmployerSide },
      employeePaid: [],
      employerPaid: [],
      programFees: [],
      totals: {
        employeePaidTotal: 0,
        employerPaidTotal: 0,
        programFeesTotal: 0,
        combinedTotal: 0,
      },
      dataType: 'estimate',
      notes,
    };
  }

  // Filter snapshots for the tax year
  const applicableSnapshots = snapshots.filter(s => s.taxYear === taxYear);

  if (applicableSnapshots.length === 0) {
    notes.push(`No payroll tax snapshots available for tax year ${taxYear}.`);
    return {
      enabled: false,
      profileType,
      inputs: { wagesAnnual, contractorIncomeAnnual, showEmployerSide },
      employeePaid: [],
      employerPaid: [],
      programFees: [],
      totals: {
        employeePaidTotal: 0,
        employerPaidTotal: 0,
        programFeesTotal: 0,
        combinedTotal: 0,
      },
      dataType: 'estimate',
      notes,
    };
  }

  // Track if all data is demo
  let allDemo = true;

  // Process each snapshot
  for (const snapshot of applicableSnapshots) {
    const { employeeItem, employerItem } = processSnapshot(snapshot, wagesAnnual, profileType);

    if (!snapshot.isDemo) {
      allDemo = false;
    }

    const isProgramFee = snapshot.metadata.isProgramFee || false;

    if (employeeItem) {
      if (isProgramFee) {
        programFees.push(employeeItem);
      } else {
        employeePaid.push(employeeItem);
      }
    }

    if (employerItem && showEmployerSide) {
      if (isProgramFee) {
        programFees.push(employerItem);
      } else {
        employerPaid.push(employerItem);
      }
    }
  }

  // Calculate totals
  const employeePaidTotal = employeePaid.reduce((sum, item) => sum + item.amount, 0);
  const employerPaidTotal = employerPaid.reduce((sum, item) => sum + item.amount, 0);
  const programFeesTotal = programFees.reduce((sum, item) => sum + item.amount, 0);
  const combinedTotal = employeePaidTotal + employerPaidTotal + programFeesTotal;

  // Round totals
  const roundedTotals = {
    employeePaidTotal: Math.round(employeePaidTotal * 100) / 100,
    employerPaidTotal: Math.round(employerPaidTotal * 100) / 100,
    programFeesTotal: Math.round(programFeesTotal * 100) / 100,
    combinedTotal: Math.round(combinedTotal * 100) / 100,
  };

  // Add notes based on profile
  if (profileType === 'w2' && showEmployerSide) {
    notes.push('Employer-paid taxes are not visible on your pay stub but are part of your total compensation cost.');
  }

  if (allDemo) {
    notes.push('Tax rates shown are demo data. Verify with official sources for accuracy.');
  }

  return {
    enabled: true,
    profileType,
    inputs: { wagesAnnual, contractorIncomeAnnual, showEmployerSide },
    employeePaid,
    employerPaid,
    programFees,
    totals: roundedTotals,
    dataType: allDemo ? 'estimate' : 'fact',
    notes,
  };
}

/**
 * Validate payroll computation inputs
 */
export function validatePayrollInputs(input: Partial<PayrollComputationInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.wagesAnnual !== undefined) {
    if (typeof input.wagesAnnual !== 'number' || isNaN(input.wagesAnnual)) {
      errors.push('wagesAnnual must be a valid number');
    } else if (input.wagesAnnual < 0) {
      errors.push('wagesAnnual cannot be negative');
    } else if (input.wagesAnnual > 100000000) {
      errors.push('wagesAnnual exceeds maximum allowed value');
    }
  }

  if (input.taxYear !== undefined) {
    if (typeof input.taxYear !== 'number' || !Number.isInteger(input.taxYear)) {
      errors.push('taxYear must be an integer');
    } else if (input.taxYear < 2020 || input.taxYear > 2030) {
      errors.push('taxYear must be between 2020 and 2030');
    }
  }

  if (input.profileType !== undefined) {
    const validTypes: ProfileType[] = ['w2', 'contractor_1099', 'self_employed', 'mixed', 'unsure'];
    if (!validTypes.includes(input.profileType)) {
      errors.push(`profileType must be one of: ${validTypes.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
