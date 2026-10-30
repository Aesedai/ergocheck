import { QUESTIONS } from '../../src/shared/questions.js';
import type { Answers } from '../../src/shared/scoring.js';

/** A complete, valid submission: the lowest-risk option everywhere unless overridden. */
export function validAnswers(overrides: Answers = {}): Answers {
  const base = Object.fromEntries(
    QUESTIONS.map((q) => [q.id, q.kind === 'multi' ? [] : [...q.options].sort((a, b) => a.points - b.points)[0]!.value]),
  );
  return { ...base, ...overrides };
}
