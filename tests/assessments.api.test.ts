import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool } from '../src/server/db.js';
import { validAnswers } from './helpers/answers.js';
import { createOrgWithUsers, login, testApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let app: FastifyInstance;
let a: Awaited<ReturnType<typeof createOrgWithUsers>>;
let b: Awaited<ReturnType<typeof createOrgWithUsers>>;
let memberA: string;
let adminA: string;
let memberB: string;

const submit = (cookie: string, answers: unknown) =>
  app.inject({ method: 'POST', url: '/api/assessments', headers: { cookie }, payload: { answers } });

beforeAll(async () => {
  await resetDb();
  app = testApp();
  a = await createOrgWithUsers('Org A');
  b = await createOrgWithUsers('Org B');
  [memberA, adminA, memberB] = await Promise.all([login(app, a.member.email), login(app, a.admin.email), login(app, b.member.email)]);
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('submitting an assessment', () => {
  it('requires authentication', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/assessments', payload: { answers: validAnswers() } });
    expect(res.statusCode).toBe(401);
  });

  it('scores on the server and stores the result', async () => {
    const res = await submit(memberA, validAnswers({ monitor_height: 'too_low', laptop: 'yes' }));
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.result.areas.find((x: { area: string }) => x.area === 'monitor').score).toBe(80);
    expect(body.totalScore).toBe(body.result.totalScore);
  });

  it('rejects incomplete or invalid answers with 400', async () => {
    const { lumbar: _l, ...missing } = validAnswers();
    expect((await submit(memberA, missing)).statusCode).toBe(400);
    expect((await submit(memberA, validAnswers({ lumbar: 'perhaps' }))).statusCode).toBe(400);
  });

  it('rejects a client-supplied score instead of trusting it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { cookie: memberA },
      payload: { answers: validAnswers({ feet: 'no' }), totalScore: 0, riskLevel: 'low' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('reading assessments', () => {
  it("lists only the caller's own history", async () => {
    await submit(adminA, validAnswers());
    await submit(memberB, validAnswers());
    const list = (await app.inject({ url: '/api/assessments', headers: { cookie: memberA } })).json();
    expect(list.length).toBeGreaterThan(0);
    const own = (await app.inject({ url: '/api/assessments', headers: { cookie: memberB } })).json();
    expect(own).toHaveLength(1);
  });

  it('returns 404 for another org’s assessment (tenant isolation through the API)', async () => {
    const bId = (await submit(memberB, validAnswers())).json().id;
    const res = await app.inject({ url: `/api/assessments/${bId}`, headers: { cookie: memberA } });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a colleague’s assessment in the same org — even to an admin', async () => {
    const id = (await submit(memberA, validAnswers())).json().id;
    expect((await app.inject({ url: `/api/assessments/${id}`, headers: { cookie: adminA } })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/assessments/${id}`, headers: { cookie: memberA } })).statusCode).toBe(200);
  });

  it('returns 404 for a malformed id', async () => {
    expect((await app.inject({ url: '/api/assessments/not-a-uuid', headers: { cookie: memberA } })).statusCode).toBe(404);
  });
});
