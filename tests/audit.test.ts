import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool, withTenant } from '../src/server/db.js';
import { validAnswers } from './helpers/answers.js';
import { createOrgWithUsers, login, testApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let app: FastifyInstance;
let a: Awaited<ReturnType<typeof createOrgWithUsers>>;
let b: Awaited<ReturnType<typeof createOrgWithUsers>>;
let memberA: string;
let adminA: string;

const actionsFor = async (orgId: string) =>
  (await getPool().query<{ action: string; actor_id: string | null; entity_id: string | null }>(
    `SELECT action, actor_id, entity_id FROM audit_log WHERE org_id = $1 ORDER BY id`,
    [orgId],
  )).rows;

beforeAll(async () => {
  await resetDb();
  app = testApp();
  a = await createOrgWithUsers('Org A');
  b = await createOrgWithUsers('Org B');
  memberA = await login(app, a.member.email);
  adminA = await login(app, a.admin.email);
  await login(app, b.member.email);
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('audit trail', () => {
  it('records logins and failed logins against the right org and user', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: a.member.email, password: 'wrong' } });
    const rows = await actionsFor(a.orgId);
    expect(rows).toContainEqual(expect.objectContaining({ action: 'auth.login', actor_id: a.member.id }));
    expect(rows).toContainEqual(expect.objectContaining({ action: 'auth.login_failed', actor_id: a.member.id }));
  });

  it('records who submitted and who viewed an assessment', async () => {
    const id = (await app.inject({ method: 'POST', url: '/api/assessments', headers: { cookie: memberA }, payload: { answers: validAnswers() } })).json().id;
    await app.inject({ url: `/api/assessments/${id}`, headers: { cookie: memberA } });
    const rows = await actionsFor(a.orgId);
    expect(rows).toContainEqual({ action: 'assessment.create', actor_id: a.member.id, entity_id: id });
    expect(rows).toContainEqual({ action: 'assessment.view', actor_id: a.member.id, entity_id: id });
  });

  it('records admin dashboard access', async () => {
    await app.inject({ url: '/api/admin/summary', headers: { cookie: adminA } });
    expect(await actionsFor(a.orgId)).toContainEqual(expect.objectContaining({ action: 'admin.summary.view', actor_id: a.admin.id }));
  });

  it('is append-only: updates and deletes are rejected, even for the table owner', async () => {
    await expect(getPool().query("UPDATE audit_log SET action = 'tampered'")).rejects.toThrow(/append-only/);
    await expect(getPool().query('DELETE FROM audit_log')).rejects.toThrow(/append-only/);
  });

  it('the app role cannot update or delete audit rows at all', async () => {
    const ctx = { orgId: a.orgId, userId: a.admin.id };
    await expect(withTenant(ctx, (tx) => tx.query("UPDATE audit_log SET action = 'x'"))).rejects.toThrow(/permission denied/);
    await expect(withTenant(ctx, (tx) => tx.query('DELETE FROM audit_log'))).rejects.toThrow(/permission denied/);
  });

  it("an org admin's audit view contains only their own org's events", async () => {
    const ids = async (orgId: string) =>
      new Set((await getPool().query<{ id: string }>('SELECT id::text FROM audit_log WHERE org_id = $1', [orgId])).rows.map((r) => r.id));
    const res = await app.inject({ url: '/api/admin/audit', headers: { cookie: adminA } });
    expect(res.statusCode).toBe(200);
    const returned: string[] = res.json().map((e: { id: string }) => e.id);
    const [orgA, orgB] = [await ids(a.orgId), await ids(b.orgId)];
    expect(orgB.size).toBeGreaterThan(0);
    expect(returned.length).toBeGreaterThan(0);
    expect(returned.every((id) => orgA.has(id) && !orgB.has(id))).toBe(true);
  });

  it('members cannot read the audit log', async () => {
    expect((await app.inject({ url: '/api/admin/audit', headers: { cookie: memberA } })).statusCode).toBe(403);
  });
});
