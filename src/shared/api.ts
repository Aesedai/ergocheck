import { z } from 'zod';
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
