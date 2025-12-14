/**
 * TaxAtlas Application Configuration
 */

export const config = {
  // Feature flags
  useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',

  // API configuration
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',

  // Supabase configuration
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

  // Default values
  defaultTaxYear: new Date().getFullYear(),
  defaultPresenceMode: 'live_work' as const,
  defaultTimeRangeYears: 7,

  // Minneapolis pilot neighborhoods (for demo)
  pilotNeighborhoods: [
    'Northeast Minneapolis',
    'Uptown',
    'North Loop',
    'Downtown',
    'Longfellow',
    'Powderhorn',
    'Dinkytown',
  ],
} as const;

export type Config = typeof config;
