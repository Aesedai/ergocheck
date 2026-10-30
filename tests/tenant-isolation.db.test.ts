import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, withTenant, type TenantContext } from '../src/server/db.js';
import { insertOrg, insertUser, resetDb } from './helpers/db.js';

// These tests deliberately issue queries WITHOUT an org_id filter: the point
// is to prove the database itself refuses cross-tenant access, so a bug in
// application code can't leak another organization's data.

let orgA: TenantContext;
let orgB: TenantContext;

const insertAssessment = (tx: Parameters<Parameters<typeof withTenant>[1]>[0], ctx: TenantContext, orgId = ctx.orgId) =>
  tx.query(
    `INSERT INTO assessments (org_id, user_id, answers, area_scores, total_score, risk_level)
     VALUES ($1, $2, '{}', '{}', 10, 'low')`,
    [orgId, ctx.userId],
  );

beforeAll(async () => {
  await resetDb();
  const a = await insertOrg('Org A');
  const b = await insertOrg('Org B');
  orgA = { orgId: a, userId: await insertUser(a, 'alice@a.example'), role: 'member' };
  orgB = { orgId: b, userId: await insertUser(b, 'bob@b.example'), role: 'member' };
  await withTenant(orgA, (tx) => insertAssessment(tx, orgA));
  await withTenant(orgB, (tx) => insertAssessment(tx, orgB));
});

afterAll(closePool);

describe('row-level tenant isolation', () => {
  it("only returns the caller's org rows from an unfiltered SELECT", async () => {
    const rows = await withTenant(orgA, async (tx) => (await tx.query('SELECT org_id FROM assessments')).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0].org_id).toBe(orgA.orgId);
  });

  it("cannot read another org's row even by primary key", async () => {
    const bId = await withTenant(orgB, async (tx) => (await tx.query('SELECT id FROM assessments')).rows[0].id);
    const rows = await withTenant(orgA, async (tx) => (await tx.query('SELECT * FROM assessments WHERE id = $1', [bId])).rows);
    expect(rows).toHaveLength(0);
  });

  it('rejects inserting a row tagged with another org', async () => {
    await expect(withTenant(orgA, (tx) => insertAssessment(tx, orgA, orgB.orgId))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("cannot update or delete another org's rows", async () => {
    const updated = await withTenant(orgA, (tx) => tx.query('UPDATE assessments SET total_score = 99 WHERE org_id = $1', [orgB.orgId]));
    const deleted = await withTenant(orgA, (tx) => tx.query('DELETE FROM assessments WHERE org_id = $1', [orgB.orgId]));
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);
  });

  it('sees nothing for a tenant id with no rows', async () => {
    const rows = await withTenant({ ...orgA, orgId: '00000000-0000-0000-0000-000000000000' }, async (tx) =>
      (await tx.query('SELECT * FROM assessments')).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects an assessment whose user belongs to a different org (composite FK)", async () => {
    await expect(
      withTenant(orgA, (tx) =>
        tx.query(
          `INSERT INTO assessments (org_id, user_id, answers, area_scores, total_score, risk_level)
           VALUES ($1, $2, '{}', '{}', 10, 'low')`,
          [orgA.orgId, orgB.userId],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});
