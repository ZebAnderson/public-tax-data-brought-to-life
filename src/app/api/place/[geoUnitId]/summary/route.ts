/**
 * GET /api/place/[geoUnitId]/summary
 * Place summary endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { geoUnitIdParamSchema, summaryQuerySchema, validate, type SummaryQueryInput } from '@/lib/validation';
import { summaryHandler } from '@/api/handlers/summary';
import { TaxAtlasError } from '@/api/middleware/error-handler';
import { CACHE_CONFIGS, buildCacheControlHeader } from '@/api/middleware/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ geoUnitId: string }> }
) {
  // Await params in Next.js 15
  const resolvedParams = await params;
  const path = `/api/place/${resolvedParams.geoUnitId}/summary`;

  try {
    // Validate path params
    const paramsValidation = validate(geoUnitIdParamSchema, resolvedParams);
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid geoUnitId',
            details: paramsValidation.error?.details,
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 400 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, string | number | undefined> = {
      year: searchParams.get('year')
        ? parseInt(searchParams.get('year')!, 10)
        : undefined,
      mode: searchParams.get('mode') || undefined,
      profile_type: searchParams.get('profile_type') || undefined,
      wages_annual: searchParams.get('wages_annual') || undefined,
      contractor_income_annual: searchParams.get('contractor_income_annual') || undefined,
      show_employer_side: searchParams.get('show_employer_side') || undefined,
    };

    // Validate query
    const queryValidation = validate(summaryQuerySchema, query);
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryValidation.error?.details,
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 400 }
      );
    }

    // Execute handler (cast needed because Zod transform types aren't narrowed properly)
    const result = await summaryHandler(paramsValidation.data!, queryValidation.data! as SummaryQueryInput);

    // Return response with cache headers
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      buildCacheControlHeader(CACHE_CONFIGS.summary)
    );
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Summary API error:', error);

    if (error instanceof TaxAtlasError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        timestamp: new Date().toISOString(),
        path,
      },
      { status: 500 }
    );
  }
}
