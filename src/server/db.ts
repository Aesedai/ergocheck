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

/**
 * The raw pool, connected as the database owner. Only migrations, the seed
 * script and db.ts itself may use it (enforced by lint); app code goes
 * through withTenant() / withAppRole().
 */
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
 * Runs fn in a transaction as the restricted ergocheck_app role, with no
 * tenant set. For the few pre-tenant lookups (login, session -> user) on
 * tables without RLS. Tenant tables return no rows here.
 *
 * The connection user itself is never used for app queries: on managed
 * Postgres it typically has BYPASSRLS (Neon's owner role does), so only the
 * restricted role is guaranteed to be bound by row-level security. SET LOCAL
 * (not SET) keeps this correct behind a transaction-mode connection pooler.
 */
export async function withAppRole<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(null, fn);
}

/**
 * Runs fn in a transaction scoped to one tenant. Inside it, queries execute as
 * the restricted ergocheck_app role with app.org_id set, so row-level security
 * limits every tenant table to the caller's organization regardless of what
 * the query itself filters on.
 */
export async function withTenant<T>(ctx: Pick<TenantContext, 'orgId' | 'userId'>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(ctx, fn);
}

async function inTransaction<T>(ctx: Pick<TenantContext, 'orgId' | 'userId'> | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ergocheck_app');
    if (ctx) {
      await client.query(
        "SELECT set_config('app.org_id', $1, true), set_config('app.user_id', $2, true)",
        [ctx.orgId, ctx.userId],
      );
    }
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
