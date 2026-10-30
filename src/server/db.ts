import pg from 'pg';
import type { Role } from '../shared/types.js';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export interface TenantContext {
  orgId: string;
  userId: string;
  role: Role;
}

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({
      connectionString,
      // Serverless instances each hold their own pool; keep it small.
      max: Number(process.env.PG_POOL_MAX ?? 5),
      ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/**
 * Runs fn in a transaction scoped to one tenant. Inside it, queries execute as
 * the restricted ergocheck_app role with app.org_id set, so row-level security
 * limits every tenant table to the caller's organization regardless of what
 * the query itself filters on.
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ergocheck_app');
    await client.query(
      "SELECT set_config('app.org_id', $1, true), set_config('app.user_id', $2, true)",
      [ctx.orgId, ctx.userId],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
