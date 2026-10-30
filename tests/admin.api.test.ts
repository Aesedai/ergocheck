import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool } from '../src/server/db.js';
import { validAnswers } from './helpers/answers.js';
import { createOrgWithUsers, login, testApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let app: FastifyInstance;
const cookies: Record<string, string> = {};

const submit = (cookie: string, answers = validAnswers()) =>
  app.inject({ method: 'POST', url: '/api/assessments', headers: { cookie }, payload: { answers } });
const summary = (cookie?: string) => app.inject({ url: '/api/admin/summary', headers: cookie ? { cookie } : {} });

beforeAll(async () => {
  await resetDb();
  app = testApp();
  const a = await createOrgWithUsers('Org A');
  const b = await createOrgWithUsers('Org B');
  for (const [k, email] of Object.entries({ adminA: a.admin.email, memberA: a.member.email, adminB: b.admin.email, memberB: b.member.email })) {
    cookies[k] = await login(app, email);
  }
  // Org A: 3 assessments from 2 people, member's latest is high risk.
  await submit(cookies.adminA!);
  await submit(cookies.memberA!);
  await submit(cookies.memberA!, validAnswers({ chair_adjust: 'none', lumbar: 'no', feet: 'no', monitor_height: 'too_low', laptop: 'yes', wrists: 'no', break_interval: 'over_2h', screen_hours: 'over_7', discomfort_areas: ['neck', 'wrists', 'lower_back'], discomfort_frequency: 'daily' }));
  // Org B: 5 assessments from 1 person.
  for (let i = 0; i < 5; i++) await submit(cookies.memberB!);
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('role-based access to the org dashboard', () => {
  it('rejects anonymous users with 401', async () => {
    expect((await summary()).statusCode).toBe(401);
  });

  it('rejects members with 403', async () => {
    expect((await summary(cookies.memberA)).statusCode).toBe(403);
  });

  it('allows org admins', async () => {
    expect((await summary(cookies.adminA)).statusCode).toBe(200);
  });
});

describe('org dashboard data is scoped to the admin’s own org', () => {
  it("org A's admin sees only org A's numbers", async () => {
    const s = (await summary(cookies.adminA)).json();
    expect(s).toMatchObject({ people: 2, participants: 2, assessments: 3 });
    expect(s.latestRisk).toEqual({ low: 1, moderate: 0, high: 1 });
  });

  it("org B's admin sees only org B's numbers", async () => {
    const s = (await summary(cookies.adminB)).json();
    expect(s).toMatchObject({ people: 2, participants: 1, assessments: 5 });
    expect(s.latestRisk).toEqual({ low: 1, moderate: 0, high: 0 });
  });

  it('ignores any attempt to name another org', async () => {
    const res = await app.inject({ url: '/api/admin/summary?orgId=anything', headers: { cookie: cookies.adminA } });
    expect(res.json().assessments).toBe(3);
  });

  it('returns aggregates only — no user identifiers or answers', async () => {
    const body = (await summary(cookies.adminA)).body;
    expect(body).not.toMatch(/@/);
    expect(body).not.toMatch(/"answers"|"userId"|"user_id"/);
  });
});
