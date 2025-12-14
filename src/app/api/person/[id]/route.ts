/**
 * GET /api/person/[id]
 * Person profile endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { personIdParamSchema, validate } from '@/lib/validation';
import { personHandler } from '@/api/handlers/person';
import { TaxAtlasError } from '@/api/middleware/error-handler';
import { CACHE_CONFIGS, buildCacheControlHeader } from '@/api/middleware/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const resolvedParams = await params;
  const path = `/api/person/${resolvedParams.id}`;

  try {
    // Validate path params
    const paramsValidation = validate(personIdParamSchema, resolvedParams);
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid person id',
            details: paramsValidation.error?.details,
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 400 }
      );
    }

    // Execute handler
    const result = await personHandler(paramsValidation.data!);

    // Return response with cache headers
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      buildCacheControlHeader(CACHE_CONFIGS.person)
    );
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Person API error:', error);

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
