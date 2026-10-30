import type { OrgSummary } from '../../shared/api.js';
import { AREAS, type Area } from '../../shared/questions.js';
import type { TenantContext, Tx } from '../db.js';

/**
 * Aggregate-only view of one organization. Nothing here identifies an
 * individual: no names, no per-person scores, no answers.
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
  const monthly = await tx.query<{ month: string; n: number; avg: string | null }>(
    `SELECT to_char(m, 'YYYY-MM') AS month, count(a.id)::int AS n, round(avg(a.total_score)) AS avg
       FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
       LEFT JOIN assessments a ON a.org_id = $1 AND date_trunc('month', a.created_at) = m
      GROUP BY m ORDER BY m`,
    [ctx.orgId],
  );

  const t = totals.rows[0]!;
  const latestRisk = { low: 0, moderate: 0, high: 0 };
  for (const r of latest.rows) latestRisk[r.risk_level as keyof typeof latestRisk] = r.n;

  return {
    people: t.people,
    participants: t.participants,
    assessments: t.assessments,
    averageScore: t.avg === null ? null : Number(t.avg),
    latestRisk,
    areas: areas.rows
      .filter((r) => (AREAS as readonly string[]).includes(r.area))
      .map((r) => ({ area: r.area, averageScore: Number(r.avg) }))
      .sort((a, b) => b.averageScore - a.averageScore),
    monthly: monthly.rows.map((r) => ({ month: r.month, assessments: r.n, averageScore: r.avg === null ? null : Number(r.avg) })),
  };
}
