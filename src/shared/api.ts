import { z } from 'zod';
import type { Area } from './questions.js';
import { AnswersSchema, type Answers, type RiskLevel, type ScoringResult } from './scoring.js';
import { ROLES } from './types.js';

// Request/response contracts shared by the API (validation) and the web
// client (typing). The server never trusts the client: every body is parsed
// with these schemas before use.

export const LoginRequest = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const Me = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    displayName: z.string(),
    role: z.enum(ROLES),
  }),
  org: z.object({ id: z.string().uuid(), name: z.string() }),
});
export type Me = z.infer<typeof Me>;

export interface ApiError {
  error: string;
  details?: unknown;
}

export const SubmitAssessmentRequest = z.object({ answers: AnswersSchema }).strict();

export interface AssessmentSummary {
  id: string;
  totalScore: number;
  riskLevel: RiskLevel;
  createdAt: string;
}

export interface AssessmentDetail extends AssessmentSummary {
  answers: Answers;
  result: ScoringResult;
}

/**
 * Below this many participants, health-derived aggregates are withheld: in a
 * small group a breakdown like "1 high risk" can identify a person.
 */
export const MIN_GROUP_SIZE = 5;

export interface OrgSummary {
  people: number;
  participants: number; // people with at least one assessment
  assessments: number;
  minGroupSize: number;
  /** Health-derived aggregates; null while participants < minGroupSize. */
  health: {
    averageScore: number;
    /** Each participant's most recent assessment, bucketed — current state of the workforce. */
    latestRisk: Record<RiskLevel, number>;
    /** Average area scores across participants' latest assessments, highest risk first. */
    areas: { area: Area; averageScore: number }[];
  } | null;
  /** Assessments completed per month for the last 6 months (oldest first). Counts only. */
  monthly: { month: string; assessments: number }[];
}
