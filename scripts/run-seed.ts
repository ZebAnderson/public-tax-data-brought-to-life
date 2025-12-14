/**
 * Run the Minneapolis pilot payroll seed
 * Usage: npx tsx scripts/run-seed.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

async function main() {
  // Get database URL from environment or use the pooler URL
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    console.log('\nTo run this script:');
    console.log('1. Get your database password from Supabase Dashboard > Settings > Database');
    console.log('2. Run: DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-us-west-2.pooler.supabase.com:6543/postgres" npx tsx scripts/run-seed.ts');
    process.exit(1);
  }

  const seedPath = join(process.cwd(), 'db', 'seeds', 'minneapolis_pilot_payroll.sql');
  const seedSql = readFileSync(seedPath, 'utf-8');

  console.log('Connecting to database...');
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected. Running seed...');

    await client.query(seedSql);

    console.log('Seed completed successfully!');

    // Verify the data
    const result = await client.query(`
      SELECT ti.name, COUNT(pts.payroll_tax_snapshot_id) as snapshot_count
      FROM tax_instrument ti
      LEFT JOIN payroll_tax_snapshot pts ON ti.tax_instrument_id = pts.tax_instrument_id
      WHERE ti.tax_type = 'payroll'
      GROUP BY ti.name
      ORDER BY ti.name
    `);

    console.log('\nPayroll instruments and snapshot counts:');
    console.table(result.rows);

  } catch (error) {
    console.error('Error running seed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
