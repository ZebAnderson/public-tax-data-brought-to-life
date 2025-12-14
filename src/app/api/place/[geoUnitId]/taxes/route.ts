/**
 * GET /api/place/[geoUnitId]/taxes
 * Taxes endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { geoUnitIdParamSchema, taxesQuerySchema, validate } from '@/lib/validation';
import { taxesHandler } from '@/api/handlers/taxes';
import { TaxAtlasError } from '@/api/middleware/error-handler';
import { CACHE_CONFIGS, buildCacheControlHeader } from '@/api/middleware/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ geoUnitId: string }> }
) {
  // Await params in Next.js 15
  const resolvedParams = await params;
  const path = `/api/place/${resolvedParams.geoUnitId}/taxes`;

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
    const query = {
      type: searchParams.get('type') || undefined,
      from: searchParams.get('from')
        ? parseInt(searchParams.get('from')!, 10)
        : undefined,
      to: searchParams.get('to')
        ? parseInt(searchParams.get('to')!, 10)
        : undefined,
    };

    // Validate query
    const queryValidation = validate(taxesQuerySchema, query);
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

    // Execute handler
    const result = await taxesHandler(paramsValidation.data!, queryValidation.data!);

    // Return response with cache headers
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      buildCacheControlHeader(CACHE_CONFIGS.taxes)
    );
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Taxes API error:', error);

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
