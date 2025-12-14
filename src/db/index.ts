/**
 * TaxAtlas Database Connection
 * Using Drizzle ORM with PostgreSQL
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL not set - using default connection');
}

// ============================================================================
// Connection Pool
// ============================================================================

const pool = new Pool({
  connectionString: DATABASE_URL || 'postgresql://localhost:5432/taxatlas',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ============================================================================
// Drizzle Instance
// ============================================================================

export const db = drizzle(pool, { schema });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current methodology version ID
 * (In production, this would be cached or configured)
 */
export async function getCurrentMethodologyVersionId(): Promise<string> {
  const result = await db.query.methodologyVersion.findFirst({
    orderBy: (mv, { desc }) => [desc(mv.createdAt)],
  });

  if (!result) {
    throw new Error('No methodology version found');
  }

  return result.methodologyVersionId;
}

/**
 * Health check - verify database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function disconnect(): Promise<void> {
  await pool.end();
}

// Export schema for use in queries
export { schema };
