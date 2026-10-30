import { MIN_GROUP_SIZE, type OrgSummary } from '../../shared/api.js';
import { AREAS, type Area } from '../../shared/questions.js';
import type { TenantContext, Tx } from '../db.js';

/**
 * Aggregate-only view of one organization. Nothing here identifies an
 * individual: no names, no per-person scores, no answers — and health-derived
 * figures are not even computed for groups smaller than MIN_GROUP_SIZE.
 */
export async function getOrgSummary(tx: Tx, ctx: TenantContext): Promise<OrgSummary> {
  // Sequential on purpose: these share one transaction (one connection), and
  // a pg client runs one query at a time anyway.
  const totals = await tx.query<{ people: number; participants: number; assessments: number; avg: string | null }>(
    `SELECT (SELECT count(*)::int FROM users WHERE org_id = $1) AS people,
            count(DISTINCT user_id)::int AS participants,
            count(*)::int AS assessments,
            round(avg(total_score)) AS avg
       FROM assessments WHERE org_id = $1`,
    [ctx.orgId],
  );
  const monthly = await tx.query<{ month: string; n: number }>(
    `SELECT to_char(m, 'YYYY-MM') AS month, count(a.id)::int AS n
       FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
       LEFT JOIN assessments a ON a.org_id = $1 AND date_trunc('month', a.created_at) = m
      GROUP BY m ORDER BY m`,
    [ctx.orgId],
  );

  const t = totals.rows[0]!;
  const base = {
    people: t.people,
    participants: t.participants,
    assessments: t.assessments,
    minGroupSize: MIN_GROUP_SIZE,
    monthly: monthly.rows.map((r) => ({ month: r.month, assessments: r.n })),
  };
  if (t.participants < MIN_GROUP_SIZE) return { ...base, health: null };

  const latest = await tx.query<{ risk_level: string; n: number }>(
    `WITH latest AS (
       SELECT DISTINCT ON (user_id) risk_level
         FROM assessments WHERE org_id = $1
        ORDER BY user_id, created_at DESC
     )
     SELECT risk_level, count(*)::int AS n FROM latest GROUP BY risk_level`,
    [ctx.orgId],
  );
  const areas = await tx.query<{ area: Area; avg: string }>(
    `WITH latest AS (
       SELECT DISTINCT ON (user_id) area_scores
         FROM assessments WHERE org_id = $1
        ORDER BY user_id, created_at DESC
     )
     SELECT a->>'area' AS area, round(avg((a->>'score')::numeric)) AS avg
       FROM latest, jsonb_array_elements(area_scores) a
      GROUP BY 1`,
    [ctx.orgId],
  );

  const latestRisk = { low: 0, moderate: 0, high: 0 };
  for (const r of latest.rows) latestRisk[r.risk_level as keyof typeof latestRisk] = r.n;

  return {
    ...base,
    health: {
      averageScore: Number(t.avg),
      latestRisk,
      areas: areas.rows
        .filter((r) => (AREAS as readonly string[]).includes(r.area))
        .map((r) => ({ area: r.area, averageScore: Number(r.avg) }))
        .sort((a, b) => b.averageScore - a.averageScore),
    },
  };
}
