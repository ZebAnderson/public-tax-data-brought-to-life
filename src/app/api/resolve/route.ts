/**
 * GET /api/resolve
 * Place resolution endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveQuerySchema, validate } from '@/lib/validation';
import { resolveHandler } from '@/api/handlers/resolve';
import { withErrorHandler, TaxAtlasError } from '@/api/middleware/error-handler';
import { CACHE_CONFIGS, buildCacheControlHeader } from '@/api/middleware/cache';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query = {
      q: searchParams.get('q') || '',
      state: searchParams.get('state') || undefined,
      city: searchParams.get('city') || undefined,
    };

    // Validate
    const validation = validate(resolveQuerySchema, query);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validation.error?.details,
          },
          timestamp: new Date().toISOString(),
          path: '/api/resolve',
        },
        { status: 400 }
      );
    }

    // Execute handler
    const result = await resolveHandler(validation.data!);

    // Return response with cache headers
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      buildCacheControlHeader(CACHE_CONFIGS.resolve)
    );
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Resolve API error:', error);

    if (error instanceof TaxAtlasError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          timestamp: new Date().toISOString(),
          path: '/api/resolve',
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        timestamp: new Date().toISOString(),
        path: '/api/resolve',
      },
      { status: 500 }
    );
  }
}
