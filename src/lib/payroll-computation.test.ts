/**
 * Unit tests for payroll tax computation
 */

import { describe, it, expect } from 'vitest';
import {
  computePayrollBreakdown,
  validatePayrollInputs,
  type PayrollSnapshotInput,
  type PayrollComputationInput,
} from './payroll-computation';

// ============================================================================
// Test Data Fixtures
// ============================================================================

/** Creates a base snapshot with sensible defaults */
function createSnapshot(overrides: Partial<PayrollSnapshotInput> = {}): PayrollSnapshotInput {
  return {
    payrollTaxSnapshotId: 'snap-001',
    taxInstrumentId: 'inst-001',
    instrumentName: 'Test Tax',
    jurisdictionName: 'Test Jurisdiction',
    jurisdictionType: 'federal',
    payrollCategory: 'social_security',
    payerType: 'shared',
    taxYear: 2024,
    employeeRate: 0.062,
    employerRate: 0.062,
    selfEmployedRate: 0.124,
    wageBaseLimit: 168600,
    wageFloor: null,
    thresholds: {},
    metadata: {
      displayName: 'Test Tax',
    },
    sourceDocId: 'src-001',
    sourceUrl: 'https://example.com/source',
    sourceTitle: 'Test Source',
    sourceRetrievedAt: new Date('2024-01-01'),
    sourcePublishedAt: '2024-01-01',
    isDemo: true,
    ...overrides,
  };
}

/** Federal Social Security (OASDI) snapshot for 2024 */
const socialSecuritySnapshot: PayrollSnapshotInput = createSnapshot({
  payrollTaxSnapshotId: 'ss-2024',
  taxInstrumentId: 'federal-ss',
  instrumentName: 'Social Security (OASDI)',
  jurisdictionName: 'United States',
  payrollCategory: 'social_security',
  employeeRate: 0.062,
  employerRate: 0.062,
  wageBaseLimit: 168600,
  metadata: {
    displayName: 'Social Security',
    microcopy: 'Funds retirement, disability, and survivor benefits.',
  },
});

/** Federal Medicare HI snapshot for 2024 */
const medicareSnapshot: PayrollSnapshotInput = createSnapshot({
  payrollTaxSnapshotId: 'medicare-2024',
  taxInstrumentId: 'federal-medicare',
  instrumentName: 'Medicare (HI)',
  jurisdictionName: 'United States',
  payrollCategory: 'medicare',
  employeeRate: 0.0145,
  employerRate: 0.0145,
  wageBaseLimit: null, // No wage cap
  metadata: {
    displayName: 'Medicare',
    microcopy: 'Funds hospital insurance for seniors and disabled.',
  },
});

/** Additional Medicare Tax snapshot (employee only, above threshold) */
const additionalMedicareSnapshot: PayrollSnapshotInput = createSnapshot({
  payrollTaxSnapshotId: 'add-medicare-2024',
  taxInstrumentId: 'federal-add-medicare',
  instrumentName: 'Additional Medicare Tax',
  jurisdictionName: 'United States',
  payrollCategory: 'medicare',
  employeeRate: 0.009,
  employerRate: null, // No employer portion
  wageBaseLimit: null,
  wageFloor: 200000, // Threshold for single filers
  thresholds: {
    singleThreshold: 200000,
    marriedJointThreshold: 250000,
    marriedSeparateThreshold: 125000,
  },
  metadata: {
    displayName: 'Additional Medicare',
    microcopy: 'Applies to wages above $200,000 (single filers).',
  },
});

/** Minnesota Paid Leave snapshot */
const mnPaidLeaveSnapshot: PayrollSnapshotInput = createSnapshot({
  payrollTaxSnapshotId: 'mn-pfl-2024',
  taxInstrumentId: 'mn-paid-leave',
  instrumentName: 'MN Paid Family & Medical Leave',
  jurisdictionName: 'Minnesota',
  jurisdictionType: 'state',
  payrollCategory: 'state_disability',
  employeeRate: 0.004,
  employerRate: 0.004,
  wageBaseLimit: 168600,
  metadata: {
    displayName: 'MN Paid Leave',
    isProgramFee: true,
    microcopy: 'State paid family and medical leave program.',
  },
});

// ============================================================================
// Test Suite: computePayrollBreakdown
// ============================================================================

describe('computePayrollBreakdown', () => {
  describe('basic computation', () => {
    it('returns disabled result for 1099 contractors', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'contractor_1099',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot, medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.enabled).toBe(false);
      expect(result.profileType).toBe('contractor_1099');
      expect(result.employeePaid).toHaveLength(0);
      expect(result.employerPaid).toHaveLength(0);
      expect(result.notes).toContain('1099 contractors pay self-employment tax instead of traditional payroll taxes.');
    });

    it('returns disabled result for zero wages', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 0,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot, medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.enabled).toBe(false);
      expect(result.notes).toContain('No W-2 wages provided.');
    });

    it('returns disabled result when no snapshots for tax year', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2025,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot], // 2024 snapshot
      };

      const result = computePayrollBreakdown(input);

      expect(result.enabled).toBe(false);
      expect(result.notes).toContain('No payroll tax snapshots available for tax year 2025.');
    });

    it('computes employee-side taxes correctly for W-2 worker', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot, medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.enabled).toBe(true);
      expect(result.employeePaid).toHaveLength(2);
      expect(result.employerPaid).toHaveLength(0); // showEmployerSide = false

      // Social Security: 100000 * 0.062 = 6200
      const ssItem = result.employeePaid.find(item => item.instrumentName === 'Social Security (OASDI)');
      expect(ssItem?.amount).toBe(6200);
      expect(ssItem?.taxableWages).toBe(100000);

      // Medicare: 100000 * 0.0145 = 1450
      const medicareItem = result.employeePaid.find(item => item.instrumentName === 'Medicare (HI)');
      expect(medicareItem?.amount).toBe(1450);

      expect(result.totals.employeePaidTotal).toBe(7650);
    });

    it('includes employer-side taxes when showEmployerSide is true', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: true,
        snapshots: [socialSecuritySnapshot, medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.enabled).toBe(true);
      expect(result.employeePaid).toHaveLength(2);
      expect(result.employerPaid).toHaveLength(2);

      expect(result.totals.employeePaidTotal).toBe(7650);
      expect(result.totals.employerPaidTotal).toBe(7650); // Same as employee for SS + Medicare
      expect(result.totals.combinedTotal).toBe(15300);
    });
  });

  describe('wage base limit handling', () => {
    it('applies Social Security wage cap correctly', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 200000, // Above $168,600 cap
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot],
      };

      const result = computePayrollBreakdown(input);

      const ssItem = result.employeePaid[0];
      // Capped at 168600 * 0.062 = 10453.20
      expect(ssItem.taxableWages).toBe(168600);
      expect(ssItem.amount).toBe(10453.2);
      expect(ssItem.wageBase).toBe(168600);
    });

    it('does not apply cap to Medicare (no wage limit)', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 500000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      const medicareItem = result.employeePaid[0];
      // No cap: 500000 * 0.0145 = 7250
      expect(medicareItem.taxableWages).toBe(500000);
      expect(medicareItem.amount).toBe(7250);
      expect(medicareItem.wageBase).toBeNull();
    });
  });

  describe('Additional Medicare Tax (threshold-based)', () => {
    it('does not apply Additional Medicare Tax below threshold', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 150000, // Below $200,000 threshold
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [additionalMedicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      // Should have no items since below threshold
      expect(result.employeePaid).toHaveLength(0);
    });

    it('applies Additional Medicare Tax on wages above threshold', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 250000, // $50,000 above threshold
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [additionalMedicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.employeePaid).toHaveLength(1);
      const addMedicareItem = result.employeePaid[0];
      // Only wages above threshold: (250000 - 200000) * 0.009 = 450
      expect(addMedicareItem.amount).toBe(450);
      expect(addMedicareItem.taxableWages).toBe(50000);
      expect(addMedicareItem.threshold).toBe(200000);
    });

    it('Additional Medicare Tax has no employer portion', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 300000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: true,
        snapshots: [additionalMedicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.employeePaid).toHaveLength(1);
      expect(result.employerPaid).toHaveLength(0); // No employer match
    });
  });

  describe('program fees', () => {
    it('categorizes state program fees separately', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: true,
        snapshots: [mnPaidLeaveSnapshot],
      };

      const result = computePayrollBreakdown(input);

      // Program fees should be in programFees array, not employeePaid
      expect(result.employeePaid).toHaveLength(0);
      expect(result.employerPaid).toHaveLength(0);
      expect(result.programFees).toHaveLength(2); // Employee + employer portions

      const employeeItem = result.programFees.find(item => item.payer === 'employee');
      const employerItem = result.programFees.find(item => item.payer === 'employer');

      expect(employeeItem?.amount).toBe(400); // 100000 * 0.004
      expect(employerItem?.amount).toBe(400);
      expect(result.totals.programFeesTotal).toBe(800);
    });
  });

  describe('full FICA computation', () => {
    it('computes complete FICA breakdown for typical W-2 income', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 75000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: true,
        snapshots: [socialSecuritySnapshot, medicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      // Employee side:
      // SS: 75000 * 0.062 = 4650
      // Medicare: 75000 * 0.0145 = 1087.50
      // Total: 5737.50
      expect(result.totals.employeePaidTotal).toBe(5737.5);

      // Employer matches:
      expect(result.totals.employerPaidTotal).toBe(5737.5);

      // Combined:
      expect(result.totals.combinedTotal).toBe(11475);
    });

    it('computes correctly for high earner above SS cap', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 300000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: true,
        snapshots: [socialSecuritySnapshot, medicareSnapshot, additionalMedicareSnapshot],
      };

      const result = computePayrollBreakdown(input);

      // Employee side:
      // SS: 168600 * 0.062 = 10453.20 (capped)
      // Medicare: 300000 * 0.0145 = 4350
      // Additional Medicare: (300000 - 200000) * 0.009 = 900
      // Total Employee: 15703.20
      expect(result.totals.employeePaidTotal).toBeCloseTo(15703.2, 2);

      // Employer side:
      // SS: 10453.20 (capped)
      // Medicare: 4350 (no cap)
      // No Additional Medicare for employer
      // Total Employer: 14803.20
      expect(result.totals.employerPaidTotal).toBeCloseTo(14803.2, 2);
    });
  });

  describe('data quality indicators', () => {
    it('marks result as estimate when all snapshots are demo', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [
          { ...socialSecuritySnapshot, isDemo: true },
          { ...medicareSnapshot, isDemo: true },
        ],
      };

      const result = computePayrollBreakdown(input);

      expect(result.dataType).toBe('estimate');
      expect(result.notes).toContain('Tax rates shown are demo data. Verify with official sources for accuracy.');
    });

    it('marks result as fact when any snapshot is not demo', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [
          { ...socialSecuritySnapshot, isDemo: false },
          { ...medicareSnapshot, isDemo: true },
        ],
      };

      const result = computePayrollBreakdown(input);

      expect(result.dataType).toBe('fact');
    });
  });

  describe('source references', () => {
    it('includes source reference for each line item', () => {
      const input: PayrollComputationInput = {
        wagesAnnual: 100000,
        taxYear: 2024,
        profileType: 'w2',
        showEmployerSide: false,
        snapshots: [socialSecuritySnapshot],
      };

      const result = computePayrollBreakdown(input);

      expect(result.employeePaid).toHaveLength(1);
      const item = result.employeePaid[0];
      expect(item.source).toBeDefined();
      expect(item.source.sourceId).toBe('src-001');
      expect(item.source.url).toBe('https://example.com/source');
      expect(item.source.isDemo).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: validatePayrollInputs
// ============================================================================

describe('validatePayrollInputs', () => {
  it('validates correct inputs', () => {
    const result = validatePayrollInputs({
      wagesAnnual: 100000,
      taxYear: 2024,
      profileType: 'w2',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects negative wages', () => {
    const result = validatePayrollInputs({
      wagesAnnual: -1000,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('wagesAnnual cannot be negative');
  });

  it('rejects wages above maximum', () => {
    const result = validatePayrollInputs({
      wagesAnnual: 200000000,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('wagesAnnual exceeds maximum allowed value');
  });

  it('rejects non-numeric wages', () => {
    const result = validatePayrollInputs({
      wagesAnnual: NaN,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('wagesAnnual must be a valid number');
  });

  it('rejects tax year outside valid range', () => {
    const result = validatePayrollInputs({
      taxYear: 2015,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('taxYear must be between 2020 and 2030');
  });

  it('rejects invalid profile type', () => {
    const result = validatePayrollInputs({
      profileType: 'invalid' as any,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('profileType must be one of');
  });
});
