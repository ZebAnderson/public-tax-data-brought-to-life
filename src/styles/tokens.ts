/**
 * TaxAtlas Design System Tokens
 * Aligned with Ant Design theme customization
 */

// ============================================================================
// Colors
// ============================================================================

export const colors = {
  // Primary brand color
  primary: '#1677ff',
  primaryHover: '#4096ff',
  primaryActive: '#0958d9',

  // Semantic colors for data types
  dataType: {
    fact: '#52c41a',      // Green - verified data
    estimate: '#faad14',  // Yellow/Gold - calculated/estimated
    signal: '#722ed1',    // Purple - proposed/pending
  },

  // Tax impact colors
  impact: {
    increase: '#ff4d4f',  // Red - tax increase
    decrease: '#52c41a',  // Green - tax decrease
    neutral: '#8c8c8c',   // Gray - no change
  },

  // Vote colors
  vote: {
    yes: '#52c41a',
    no: '#ff4d4f',
    abstain: '#faad14',
    absent: '#d9d9d9',
  },

  // Confidence levels
  confidence: {
    high: '#52c41a',
    medium: '#faad14',
    low: '#ff4d4f',
  },

  // Status colors
  status: {
    proposed: '#722ed1',
    pending: '#1677ff',
    enacted: '#52c41a',
    withdrawn: '#8c8c8c',
    expired: '#d9d9d9',
    unknown: '#8c8c8c',
  },

  // Jurisdiction type colors (for charts/badges)
  jurisdiction: {
    federal: '#1d39c4',
    state: '#531dab',
    county: '#08979c',
    city: '#389e0d',
    school: '#d46b08',
    special: '#c41d7f',
  },

  // Neutral palette
  neutral: {
    bg: '#f5f5f5',
    bgContainer: '#ffffff',
    border: '#d9d9d9',
    borderSecondary: '#f0f0f0',
    text: 'rgba(0, 0, 0, 0.88)',
    textSecondary: 'rgba(0, 0, 0, 0.65)',
    textTertiary: 'rgba(0, 0, 0, 0.45)',
    textDisabled: 'rgba(0, 0, 0, 0.25)',
  },

  // Demo mode indicator
  demo: '#ff7a45',
} as const;

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  fontFamilyCode: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`,

  // Font sizes (matching AntD)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 14,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 38,
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5715,
    relaxed: 1.75,
  },

  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ============================================================================
// Spacing
// ============================================================================

export const spacing = {
  // Base unit: 4px (matching AntD)
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const borderRadius = {
  none: 0,
  sm: 2,
  base: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ============================================================================
// Shadows
// ============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
  base: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  lg: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
} as const;

// ============================================================================
// Breakpoints
// ============================================================================

export const breakpoints = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const;

// ============================================================================
// Z-Index
// ============================================================================

export const zIndex = {
  dropdown: 1050,
  modal: 1000,
  drawer: 1000,
  tooltip: 1070,
  notification: 1090,
} as const;

// ============================================================================
// Ant Design Theme Config
// ============================================================================

export const antdTheme = {
  token: {
    colorPrimary: colors.primary,
    colorSuccess: colors.dataType.fact,
    colorWarning: colors.dataType.estimate,
    colorError: colors.impact.increase,
    colorInfo: colors.primary,
    borderRadius: borderRadius.base,
    fontFamily: typography.fontFamily,
  },
  components: {
    Layout: {
      headerBg: colors.neutral.bgContainer,
      bodyBg: colors.neutral.bg,
      siderBg: colors.neutral.bgContainer,
    },
    Card: {
      paddingLG: spacing[6],
    },
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get color for data type badge
 */
export function getDataTypeColor(dataType: 'fact' | 'estimate' | 'signal'): string {
  return colors.dataType[dataType];
}

/**
 * Get color for impact direction
 */
export function getImpactColor(direction: 'increase' | 'decrease' | 'neutral'): string {
  return colors.impact[direction];
}

/**
 * Get color for vote value
 */
export function getVoteColor(vote: 'yes' | 'no' | 'abstain' | 'absent'): string {
  return colors.vote[vote];
}

/**
 * Get color for jurisdiction type
 */
export function getJurisdictionColor(type: string): string {
  return colors.jurisdiction[type as keyof typeof colors.jurisdiction] ?? colors.neutral.textSecondary;
}
