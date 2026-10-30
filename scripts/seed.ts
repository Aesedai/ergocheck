import bcrypt from 'bcryptjs';
import { QUESTIONS } from '../src/shared/questions.js';
import { scoreAssessment, type Answers } from '../src/shared/scoring.js';
import { closePool, getPool, type Tx } from '../src/server/db.js';
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
  /** 0..1 — how likely each answer is to be a risky one; gives orgs distinct profiles. */
  riskiness: number;
}

export const SEED_ORGS: SeedOrg[] = [
  { name: 'Harbor & Pine Insurance', slug: 'harbor-pine', domain: 'harborpine.example', admin: 'Dana Okafor', members: ['Alex Rivera', 'Priya Natarajan', 'Sam Whitfield', 'Mei Chen'], riskiness: 0.5 },
  { name: 'Cobalt Freight Co.', slug: 'cobalt-freight', domain: 'cobaltfreight.example', admin: 'Luis Ortega', members: ['Jordan Blake', 'Aisha Mensah', 'Tom Kowalski'], riskiness: 0.8 },
  { name: 'Meridian Dental Group', slug: 'meridian-dental', domain: 'meridiandental.example', admin: 'Grace Lindqvist', members: ['Ravi Patel', 'Hannah Moore'], riskiness: 0.35 },
];

const emailFor = (name: string, domain: string) => `${name.split(' ')[0]!.toLowerCase()}@${domain}`;

// Deterministic PRNG so every seed produces the same demo data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAnswers(rand: () => number, riskiness: number): Answers {
  return Object.fromEntries(
    QUESTIONS.map((q) => {
      if (q.kind === 'multi') return [q.id, q.options.filter(() => rand() < riskiness * 0.6).map((o) => o.value)];
      const sorted = [...q.options].sort((a, b) => a.points - b.points);
      const risky = rand() < riskiness;
      const pool = risky && sorted.length > 1 ? sorted.slice(1) : sorted.slice(0, 1);
      return [q.id, pool[Math.floor(rand() * pool.length)]!.value];
    }),
  );
}

async function insertAssessments(tx: Tx, orgId: string, userId: string, count: number, rand: () => number, riskiness: number) {
  for (let i = 0; i < count; i++) {
    // Spread over the last ~90 days, oldest first, each one a little better than the last.
    const daysAgo = Math.round(((count - i) / count) * 85 + rand() * 5);
    const answers = randomAnswers(rand, Math.max(0.05, riskiness - i * 0.08));
    const r = scoreAssessment(answers);
    await tx.query(
      `INSERT INTO assessments (org_id, user_id, answers, area_scores, total_score, risk_level, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(days => $7))`,
      [orgId, userId, JSON.stringify(answers), JSON.stringify(r.areas), r.totalScore, r.riskLevel, daysAgo],
    );
  }
}

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
      // Set the tenant so inserts satisfy RLS even if the seeding role is bound by it
      // (an owner with BYPASSRLS, as on Neon, or a superuser, skips RLS anyway).
      await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
      const rand = mulberry32(org.slug.length * 7919);
      const people = [{ name: org.admin, role: 'org_admin' }, ...org.members.map((name) => ({ name, role: 'member' }))];
      for (const p of people) {
        const { rows: u } = await client.query<{ id: string }>(
          `INSERT INTO users (org_id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [orgId, emailFor(p.name, org.domain), p.name, hash, p.role],
        );
        await insertAssessments(client, orgId, u[0]!.id, 2 + Math.floor(rand() * 4), rand, org.riskiness);
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
