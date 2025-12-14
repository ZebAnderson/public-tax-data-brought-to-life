import pg from 'pg';
import { requireEnv } from './env.js';

const { Pool } = pg;

export type DbClient = pg.PoolClient;

export function createPool(): pg.Pool {
  const connectionString = requireEnv('DATABASE_URL');
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function withClient<T>(
  pool: pg.Pool,
  fn: (client: DbClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  client: DbClient,
  fn: () => Promise<T>
): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

