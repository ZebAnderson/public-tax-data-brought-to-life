/**
 * GET /api/place/[geoUnitId]/pending
 * Pending policy signals endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { geoUnitIdParamSchema, validate } from '@/lib/validation';
import { pendingHandler } from '@/api/handlers/pending';
import { TaxAtlasError } from '@/api/middleware/error-handler';
import { CACHE_CONFIGS, buildCacheControlHeader } from '@/api/middleware/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ geoUnitId: string }> }
) {
  // Await params in Next.js 15
  const resolvedParams = await params;
  const path = `/api/place/${resolvedParams.geoUnitId}/pending`;

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

    // Execute handler
    const result = await pendingHandler(paramsValidation.data!);

    // Return response with cache headers
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      buildCacheControlHeader(CACHE_CONFIGS.pending)
    );
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Pending API error:', error);

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
