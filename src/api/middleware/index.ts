/**
 * TaxAtlas API Middleware
 * Export all middleware
 */

export {
  TaxAtlasError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  withErrorHandler,
  expressErrorHandler,
} from './error-handler';

export {
  CACHE_CONFIGS,
  buildCacheControlHeader,
  setCacheHeaders,
  setNoCacheHeaders,
  withCaching,
  checkETagMatch,
  generateETag,
} from './cache';
