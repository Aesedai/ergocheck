import pg from 'pg';

/**
 * Points the test run at a dedicated database (never the dev database, since
 * tests drop the schema) and creates it if it doesn't exist yet.
 */
export default async function setup(): Promise<void> {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ergocheck_test');
  process.env.DATABASE_URL = url.toString();

  const dbName = url.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}
