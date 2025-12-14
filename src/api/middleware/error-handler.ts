/**
 * TaxAtlas Error Handling Middleware
 * Consistent error responses across all endpoints
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { ApiError } from '../../types/api';
import { ZodError } from 'zod';

// ============================================================================
// Error Classes
// ============================================================================

export class TaxAtlasError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaxAtlasError';
  }
}

export class NotFoundError extends TaxAtlasError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends TaxAtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends TaxAtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

// ============================================================================
// Error Response Builder
// ============================================================================

function buildErrorResponse(
  error: unknown,
  path: string
): { statusCode: number; body: ApiError } {
  const timestamp = new Date().toISOString();

  // Handle known error types
  if (error instanceof TaxAtlasError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        timestamp,
        path,
      },
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        timestamp,
        path,
      },
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    // Check for "not found" patterns in error messages
    if (error.message.toLowerCase().includes('not found')) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
          timestamp,
          path,
        },
      };
    }

    // Log unexpected errors
    console.error('Unexpected error:', error);

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        timestamp,
        path,
      },
    };
  }

  // Unknown error type
  console.error('Unknown error type:', error);

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      timestamp,
      path,
    },
  };
}

// ============================================================================
// Middleware Wrapper
// ============================================================================

type ApiHandler<T> = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<T>;

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandler<T>(
  handler: ApiHandler<T>
): ApiHandler<void> {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const result = await handler(req, res);

      // If the handler already sent a response, don't send again
      if (res.headersSent) {
        return;
      }

      // Send successful response
      res.status(200).json(result);
    } catch (error) {
      const path = req.url ?? '/';
      const { statusCode, body } = buildErrorResponse(error, path);

      res.status(statusCode).json(body);
    }
  };
}

// ============================================================================
// Express-style Middleware (for non-Next.js usage)
// ============================================================================

export interface RequestContext {
  path: string;
  method: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
}

/**
 * Express-compatible error handler
 */
export function expressErrorHandler(
  error: unknown,
  context: RequestContext
): { statusCode: number; body: ApiError } {
  return buildErrorResponse(error, context.path);
}
