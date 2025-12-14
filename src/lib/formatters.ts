/**
 * TaxAtlas Formatting Utilities
 * Consistent formatting for numbers, dates, and display strings
 */

import dayjs from 'dayjs';

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  if (amount === null || amount === undefined) return '—';

  const { compact = false, decimals = 0 } = options;

  if (compact && Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a rate/percentage
 */
export function formatRate(
  rate: number | null | undefined,
  unit: string = 'percent'
): string {
  if (rate === null || rate === undefined) return '—';

  if (unit === 'progressive') {
    return 'Progressive';
  }

  if (unit === 'percent' || unit === 'percent_of_value') {
    return `${rate.toFixed(rate < 1 ? 3 : 2)}%`;
  }

  if (unit === 'mills') {
    return `${rate.toFixed(2)} mills`;
  }

  if (unit === 'per_dollar') {
    return `$${rate.toFixed(4)} per $1`;
  }

  return `${rate}`;
}

/**
 * Format a number with commas
 */
export function formatNumber(
  num: number | null | undefined,
  options: { compact?: boolean } = {}
): string {
  if (num === null || num === undefined) return '—';

  if (options.compact && Math.abs(num) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }

  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a percentage
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format change with direction indicator
 */
export function formatChange(
  changePercent: number | null | undefined,
  direction: 'up' | 'down' | 'stable' | null | undefined
): string {
  if (changePercent === null || changePercent === undefined) return '—';

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  return `${arrow} ${Math.abs(changePercent).toFixed(1)}%`;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a date string
 */
export function formatDate(
  date: string | null | undefined,
  format: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!date) return '—';

  const d = dayjs(date);
  if (!d.isValid()) return '—';

  switch (format) {
    case 'short':
      return d.format('M/D/YY');
    case 'medium':
      return d.format('MMM D, YYYY');
    case 'long':
      return d.format('MMMM D, YYYY');
    default:
      return d.format('MMM D, YYYY');
  }
}

/**
 * Format a date as relative time
 */
export function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return '—';

  const d = dayjs(date);
  if (!d.isValid()) return '—';

  const now = dayjs();
  const diffDays = now.diff(d, 'day');

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format a year range
 */
export function formatYearRange(from: number, to: number): string {
  if (from === to) return String(from);
  return `${from}–${to}`;
}

// ============================================================================
// Display Name Formatting
// ============================================================================

/**
 * Format tax type for display
 */
export function formatTaxType(taxType: string): string {
  const names: Record<string, string> = {
    property: 'Property Tax',
    sales: 'Sales Tax',
    income: 'Income Tax',
    payroll: 'Payroll Tax',
    corporate: 'Corporate Tax',
    excise: 'Excise Tax',
    lodging: 'Lodging Tax',
    utility: 'Utility Tax',
    other: 'Other Taxes',
  };
  return names[taxType] ?? taxType;
}

/**
 * Format jurisdiction type for display
 */
export function formatJurisdictionType(type: string): string {
  const names: Record<string, string> = {
    federal: 'Federal',
    state: 'State',
    county: 'County',
    city: 'City',
    school: 'School District',
    special: 'Special District',
  };
  return names[type] ?? type;
}

/**
 * Format data type for display
 */
export function formatDataType(dataType: string): string {
  const names: Record<string, string> = {
    fact: 'Verified',
    estimate: 'Estimated',
    signal: 'Proposed',
  };
  return names[dataType] ?? dataType;
}

/**
 * Format vote value for display
 */
export function formatVoteValue(vote: string): string {
  const names: Record<string, string> = {
    yes: 'Yes',
    no: 'No',
    abstain: 'Abstain',
    absent: 'Absent',
    present: 'Present',
  };
  return names[vote] ?? vote;
}

/**
 * Format impact direction for display
 */
export function formatImpactDirection(direction: string): string {
  const names: Record<string, string> = {
    increase: 'Increase',
    decrease: 'Decrease',
    no_change: 'No Change',
    restructure: 'Restructure',
    unknown: 'Unknown',
  };
  return names[direction] ?? direction;
}

/**
 * Format policy signal status
 */
export function formatSignalStatus(status: string): string {
  const names: Record<string, string> = {
    proposed: 'Proposed',
    pending: 'Pending',
    enacted: 'Enacted',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  };
  return names[status] ?? status;
}

/**
 * Format signal type for display
 */
export function formatSignalType(type: string): string {
  const names: Record<string, string> = {
    proposed_budget: 'Proposed Budget',
    pending_legislation: 'Pending Legislation',
    ballot_measure: 'Ballot Measure',
    referendum: 'Referendum',
    other: 'Other',
  };
  return names[type] ?? type;
}

/**
 * Format geo unit type
 */
export function formatGeoUnitType(type: string): string {
  const names: Record<string, string> = {
    neighborhood: 'Neighborhood',
    zip: 'ZIP Code',
    city: 'City',
    county: 'County',
    state: 'State',
    tract: 'Census Tract',
  };
  return names[type] ?? type;
}

/**
 * Format presence mode
 */
export function formatPresenceMode(mode: string): string {
  const names: Record<string, string> = {
    live: 'Live',
    work: 'Work',
    live_work: 'Live & Work',
    both: 'Live & Work',
  };
  return names[mode] ?? mode;
}
