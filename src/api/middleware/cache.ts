/**
 * TaxAtlas Caching Middleware
 * HTTP cache headers for read-heavy endpoints
 */

import type { NextApiResponse } from 'next';

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  /** Cache duration in seconds */
  maxAge: number;
  /** Stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number;
  /** Whether to allow private caching only */
  private?: boolean;
  /** Whether this is immutable content */
  immutable?: boolean;
}

// Default cache configurations by endpoint type
export const CACHE_CONFIGS = {
  // Place resolution - short cache, data rarely changes
  resolve: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 3600, // 1 hour
  },

  // Summary - medium cache, updated periodically
  summary: {
    maxAge: 900, // 15 minutes
    staleWhileRevalidate: 3600, // 1 hour
  },

  // Tax details - longer cache, annual data
  taxes: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },

  // Accountability - longer cache, historical data
  accountability: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },

  // Pending - shorter cache, may change frequently
  pending: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 900, // 15 minutes
  },

  // Person - medium cache
  person: {
    maxAge: 1800, // 30 minutes
    staleWhileRevalidate: 3600, // 1 hour
  },

  // Static/methodology - long cache
  static: {
    maxAge: 86400, // 24 hours
    staleWhileRevalidate: 604800, // 7 days
    immutable: true,
  },

  // No cache
  none: {
    maxAge: 0,
  },
} as const;

// ============================================================================
// Cache Header Builder
// ============================================================================

/**
 * Build Cache-Control header value
 */
export function buildCacheControlHeader(config: CacheConfig): string {
  const parts: string[] = [];

  if (config.private) {
    parts.push('private');
  } else {
    parts.push('public');
  }

  parts.push(`max-age=${config.maxAge}`);

  if (config.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}

/**
 * Set cache headers on response
 */
export function setCacheHeaders(
  res: NextApiResponse,
  config: CacheConfig
): void {
  const cacheControl = buildCacheControlHeader(config);

  res.setHeader('Cache-Control', cacheControl);

  // Add Vary header for proper cache keying
  res.setHeader('Vary', 'Accept-Encoding');

  // Add ETag support hint
  // Actual ETag generation would be based on content hash
}

/**
 * Set no-cache headers
 */
export function setNoCacheHeaders(res: NextApiResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ============================================================================
// Middleware Wrapper
// ============================================================================

type EndpointType = keyof typeof CACHE_CONFIGS;

/**
 * Apply cache headers based on endpoint type
 */
export function withCaching<T>(
  endpointType: EndpointType,
  handler: (res: NextApiResponse) => Promise<T>
): (res: NextApiResponse) => Promise<T> {
  return async (res: NextApiResponse) => {
    const config = CACHE_CONFIGS[endpointType];

    if (config.maxAge > 0) {
      setCacheHeaders(res, config);
    } else {
      setNoCacheHeaders(res);
    }

    return handler(res);
  };
}

// ============================================================================
// Conditional Caching
// ============================================================================

/**
 * Check if request has valid ETag match
 * Returns true if content hasn't changed (304 response appropriate)
 */
export function checkETagMatch(
  requestETag: string | undefined,
  currentETag: string
): boolean {
  if (!requestETag) {
    return false;
  }

  // Handle weak ETags
  const normalizedRequest = requestETag.replace(/^W\//, '').replace(/"/g, '');
  const normalizedCurrent = currentETag.replace(/^W\//, '').replace(/"/g, '');

  return normalizedRequest === normalizedCurrent;
}

/**
 * Generate ETag from content
 */
export function generateETag(content: string | object): string {
  const crypto = require('crypto');
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  return `W/"${hash}"`;
}
