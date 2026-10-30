import { z } from 'zod';
import { AREAS, QUESTIONS, type Area, type Question } from './questions.js';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface AreaResult {
  area: Area;
  score: number; // 0–100, higher = more risk
  level: RiskLevel;
  tips: string[];
}

export interface ScoringResult {
  totalScore: number; // 0–100
  riskLevel: RiskLevel;
  areas: AreaResult[];
}

export type Answers = Record<string, string | string[]>;

// Reported discomfort is the strongest signal, so it counts double.
const AREA_WEIGHTS: Record<Area, number> = { seating: 1, monitor: 1, input: 1, breaks: 1, discomfort: 2 };

export function riskLevelFor(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

function maxPoints(q: Question): number {
  return q.kind === 'multi'
    ? q.options.reduce((sum, o) => sum + o.points, 0)
    : Math.max(...q.options.map((o) => o.points));
}

/** Zod schema for a submission, derived from the question definitions. */
export const AnswersSchema = z
  .object(
    Object.fromEntries(
      QUESTIONS.map((q) => {
        const values = q.options.map((o) => o.value) as [string, ...string[]];
        const schema =
          q.kind === 'multi'
            ? z
                .array(z.enum(values))
                .max(values.length)
                .refine((a) => new Set(a).size === a.length, 'duplicate selections')
            : z.enum(values);
        return [q.id, schema];
      }),
    ),
  )
  .strict();

/** Pure, deterministic scoring. Assumes answers have passed AnswersSchema. */
export function scoreAssessment(answers: Answers): ScoringResult {
  const areas = AREAS.map((area): AreaResult => {
    const qs = QUESTIONS.filter((q) => q.area === area);
    let earned = 0;
    let possible = 0;
    const tips: string[] = [];
    for (const q of qs) {
      possible += maxPoints(q);
      const raw = answers[q.id];
      const chosen = q.options.filter((o) => (Array.isArray(raw) ? raw.includes(o.value) : raw === o.value));
      for (const o of chosen) {
        earned += o.points;
        if (o.points > 0 && o.tip) tips.push(o.tip);
      }
    }
    const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);
    return { area, score, level: riskLevelFor(score), tips };
  });

  const weightSum = areas.reduce((s, a) => s + AREA_WEIGHTS[a.area], 0);
  const totalScore = Math.round(areas.reduce((s, a) => s + a.score * AREA_WEIGHTS[a.area], 0) / weightSum);
  return { totalScore, riskLevel: riskLevelFor(totalScore), areas };
}
