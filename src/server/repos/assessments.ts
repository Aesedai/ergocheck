import type { Answers, ScoringResult } from '../../shared/scoring.js';
import type { AssessmentDetail, AssessmentSummary } from '../../shared/api.js';
import type { TenantContext, Tx } from '../db.js';

// Every query filters by org_id explicitly even though RLS already does:
// the explicit filter documents intent and keeps the query correct if it is
// ever run outside withTenant(); RLS is the backstop if a filter is forgotten.

interface Row {
  id: string;
  user_id: string;
  answers: Answers;
  area_scores: ScoringResult['areas'];
  total_score: number;
  risk_level: ScoringResult['riskLevel'];
  created_at: Date;
}

const toSummary = (r: Row): AssessmentSummary => ({
  id: r.id,
  totalScore: r.total_score,
  riskLevel: r.risk_level,
  createdAt: r.created_at.toISOString(),
});

export async function insertAssessment(tx: Tx, ctx: TenantContext, answers: Answers, result: ScoringResult): Promise<AssessmentDetail> {
  const { rows } = await tx.query<Row>(
    `INSERT INTO assessments (org_id, user_id, answers, area_scores, total_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ctx.orgId, ctx.userId, JSON.stringify(answers), JSON.stringify(result.areas), result.totalScore, result.riskLevel],
  );
  return toDetail(rows[0]!);
}

export async function listOwnAssessments(tx: Tx, ctx: TenantContext, limit = 50): Promise<AssessmentSummary[]> {
  const { rows } = await tx.query<Row>(
    `SELECT * FROM assessments
      WHERE org_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [ctx.orgId, ctx.userId, limit],
  );
  return rows.map(toSummary);
}

/** Owner-only: an assessment holds personal health information. Admins get aggregates, not individual answers. */
export async function getOwnAssessment(tx: Tx, ctx: TenantContext, id: string): Promise<AssessmentDetail | null> {
  const { rows } = await tx.query<Row>('SELECT * FROM assessments WHERE id = $1 AND org_id = $2 AND user_id = $3', [
    id,
    ctx.orgId,
    ctx.userId,
  ]);
  return rows[0] ? toDetail(rows[0]) : null;
}

function toDetail(r: Row): AssessmentDetail {
  return {
    ...toSummary(r),
    answers: r.answers,
    result: { totalScore: r.total_score, riskLevel: r.risk_level, areas: r.area_scores },
  };
}
