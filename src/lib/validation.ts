/**
 * TaxAtlas API Input Validation Schemas
 * Using Zod for runtime validation
 */

import { z } from 'zod';

// ============================================================================
// Common Validators
// ============================================================================

/** Valid US state codes */
const stateCodeSchema = z.string().length(2).toUpperCase().regex(/^[A-Z]{2}$/);

/** UUID format */
const uuidSchema = z.string().uuid();

/** Tax year range */
const taxYearSchema = z.coerce.number().int().min(1900).max(2200);

/** Presence mode - accepts 'both' as alias for 'live_work' */
const presenceModeSchema = z.enum(['live', 'work', 'live_work', 'both']).transform(
  (val): 'live' | 'work' | 'live_work' => (val === 'both' ? 'live_work' : val)
);

/** Tax type */
const taxTypeSchema = z.enum([
  'property',
  'sales',
  'income',
  'payroll',
  'corporate',
  'excise',
  'lodging',
  'utility',
  'other',
]);

/** Profile type for income/pay classification */
const profileTypeSchema = z.enum([
  'w2',
  'contractor_1099',
  'self_employed',
  'mixed',
  'unsure',
]);

/** Positive number for income inputs */
const positiveNumberSchema = z.coerce.number().min(0).max(100000000);

/** Boolean from string query param */
const booleanStringSchema = z.enum(['true', 'false']).transform(val => val === 'true');

// ============================================================================
// GET /api/resolve
// ============================================================================

export const resolveQuerySchema = z.object({
  /** Search query (neighborhood, ZIP, or city name) */
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long')
    .trim(),

  /** Optional: filter by state code (e.g., "MN") */
  state: stateCodeSchema.optional(),

  /** Optional: filter by city name */
  city: z.string().max(100).trim().optional(),
});

export type ResolveQueryInput = z.infer<typeof resolveQuerySchema>;

// ============================================================================
// GET /api/place/:geoUnitId/summary
// ============================================================================

export const geoUnitIdParamSchema = z.object({
  geoUnitId: uuidSchema,
});

export const summaryQuerySchema = z.object({
  /** Tax year (defaults to current year) */
  year: taxYearSchema.optional(),

  /** Presence mode (defaults to 'live_work') */
  mode: presenceModeSchema.optional(),

  /** Profile type for payroll computation (e.g., 'w2', 'contractor_1099') */
  profile_type: profileTypeSchema.optional(),

  /** Annual W-2 wages for payroll computation */
  wages_annual: positiveNumberSchema.optional(),

  /** Annual 1099 contractor income for self-employment tax */
  contractor_income_annual: positiveNumberSchema.optional(),

  /** Whether to include employer-side taxes in payroll breakdown */
  show_employer_side: booleanStringSchema.optional(),
});

export type GeoUnitIdParam = z.infer<typeof geoUnitIdParamSchema>;
// Explicitly define output type since Zod transform doesn't narrow properly
export type SummaryQueryInput = {
  year?: number;
  mode?: 'live' | 'work' | 'live_work';
  profile_type?: 'w2' | 'contractor_1099' | 'self_employed' | 'mixed' | 'unsure';
  wages_annual?: number;
  contractor_income_annual?: number;
  show_employer_side?: boolean;
};

// ============================================================================
// GET /api/place/:geoUnitId/taxes
// ============================================================================

export const taxesQuerySchema = z.object({
  /** Filter by tax type */
  type: taxTypeSchema.optional(),

  /** Start year for time series */
  from: taxYearSchema.optional(),

  /** End year for time series */
  to: taxYearSchema.optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to;
    }
    return true;
  },
  { message: "'from' year must be less than or equal to 'to' year" }
);

export type TaxesQueryInput = z.infer<typeof taxesQuerySchema>;

// ============================================================================
// GET /api/place/:geoUnitId/accountability
// ============================================================================

export const accountabilityQuerySchema = z.object({
  /** Filter by tax type */
  taxType: taxTypeSchema.optional(),

  /** Start year */
  from: taxYearSchema.optional(),

  /** End year */
  to: taxYearSchema.optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to;
    }
    return true;
  },
  { message: "'from' year must be less than or equal to 'to' year" }
);

export type AccountabilityQueryInput = z.infer<typeof accountabilityQuerySchema>;

// ============================================================================
// GET /api/place/:geoUnitId/pending
// ============================================================================

// No query params needed for pending endpoint
export const pendingQuerySchema = z.object({});

export type PendingQueryInput = z.infer<typeof pendingQuerySchema>;

// ============================================================================
// GET /api/person/:id
// ============================================================================

export const personIdParamSchema = z.object({
  id: uuidSchema,
});

export type PersonIdParam = z.infer<typeof personIdParamSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: z.ZodIssue[];
  };
}

/**
 * Validate input against a Zod schema
 * Uses ZodType with flexible input type to support transforms
 */
export function validate<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: result.error.issues,
    },
  };
}
