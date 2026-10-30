import { getPool } from '../../src/server/db.js';
import { migrate } from '../../src/server/migrate.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/ergocheck';

/** Drops and recreates the public schema, then applies all migrations. */
export async function resetDb(): Promise<void> {
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
}

export async function insertOrg(name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { rows } = await getPool().query<{ id: string }>(
    'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
    [name, slug],
  );
  return rows[0]!.id;
}

export async function insertUser(
  orgId: string,
  email: string,
  role: 'member' | 'org_admin' = 'member',
  passwordHash = 'x',
): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO users (org_id, email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [orgId, email, email.split('@')[0], passwordHash, role],
  );
  return rows[0]!.id;
}
