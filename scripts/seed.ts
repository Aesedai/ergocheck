import bcrypt from 'bcryptjs';
import { closePool, getPool } from '../src/server/db.js';
import { migrate } from '../src/server/migrate.js';

/**
 * Idempotent demo seed: wipes tenant data and recreates three fictional
 * organizations with an admin and a few members each. Every demo account
 * uses the same password, shown on the login screen.
 */
export const DEMO_PASSWORD = 'ergocheck-demo';

interface SeedOrg {
  name: string;
  slug: string;
  domain: string;
  admin: string;
  members: string[];
}

export const SEED_ORGS: SeedOrg[] = [
  { name: 'Harbor & Pine Insurance', slug: 'harbor-pine', domain: 'harborpine.example', admin: 'Dana Okafor', members: ['Alex Rivera', 'Priya Natarajan', 'Sam Whitfield', 'Mei Chen'] },
  { name: 'Cobalt Freight Co.', slug: 'cobalt-freight', domain: 'cobaltfreight.example', admin: 'Luis Ortega', members: ['Jordan Blake', 'Aisha Mensah', 'Tom Kowalski'] },
  { name: 'Meridian Dental Group', slug: 'meridian-dental', domain: 'meridiandental.example', admin: 'Grace Lindqvist', members: ['Ravi Patel', 'Hannah Moore'] },
];

const emailFor = (name: string, domain: string) => `${name.split(' ')[0]!.toLowerCase()}@${domain}`;

export async function seed(): Promise<void> {
  const pool = getPool();
  await migrate(pool);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE organizations, users, sessions, assessments CASCADE');
    for (const org of SEED_ORGS) {
      const { rows } = await client.query<{ id: string }>(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
        [org.name, org.slug],
      );
      const orgId = rows[0]!.id;
      const people = [{ name: org.admin, role: 'org_admin' }, ...org.members.map((name) => ({ name, role: 'member' }))];
      for (const p of people) {
        await client.query(
          `INSERT INTO users (org_id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
          [orgId, emailFor(p.name, org.domain), p.name, hash, p.role],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
  console.log('seeded', SEED_ORGS.map((o) => o.name).join(', '));
  await closePool();
}
