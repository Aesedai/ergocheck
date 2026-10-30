import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/shared/questions.js';
import { AnswersSchema, riskLevelFor, scoreAssessment, type Answers } from '../src/shared/scoring.js';

const pick = (choose: 'best' | 'worst'): Answers =>
  Object.fromEntries(
    QUESTIONS.map((q) => {
      if (q.kind === 'multi') return [q.id, choose === 'best' ? [] : q.options.map((o) => o.value)];
      const sorted = [...q.options].sort((a, b) => a.points - b.points);
      return [q.id, (choose === 'best' ? sorted[0] : sorted.at(-1))!.value];
    }),
  );

describe('scoreAssessment', () => {
  it('scores an ideal setup as 0 / low with no tips', () => {
    const r = scoreAssessment(pick('best'));
    expect(r.totalScore).toBe(0);
    expect(r.riskLevel).toBe('low');
    expect(r.areas.every((a) => a.score === 0 && a.tips.length === 0)).toBe(true);
  });

  it('scores the worst answers as 100 / high in every area', () => {
    const r = scoreAssessment(pick('worst'));
    expect(r.totalScore).toBe(100);
    expect(r.riskLevel).toBe('high');
    expect(r.areas.every((a) => a.score === 100 && a.level === 'high')).toBe(true);
  });

  it('weights reported discomfort double', () => {
    const answers = { ...pick('best'), discomfort_areas: ['neck', 'shoulders', 'upper_back', 'lower_back', 'wrists', 'eyes'], discomfort_frequency: 'daily' };
    // discomfort area = 100, others 0 → 100*2 / 6 = 33
    expect(scoreAssessment(answers).totalScore).toBe(33);
  });

  it('returns guidance only for answers that carry risk', () => {
    const r = scoreAssessment({ ...pick('best'), monitor_height: 'too_low' });
    const monitor = r.areas.find((a) => a.area === 'monitor')!;
    expect(monitor.tips).toEqual([expect.stringContaining('Raise the screen')]);
    expect(r.areas.filter((a) => a.area !== 'monitor').every((a) => a.tips.length === 0)).toBe(true);
  });

  it.each([
    [0, 'low'],
    [29, 'low'],
    [30, 'moderate'],
    [59, 'moderate'],
    [60, 'high'],
    [100, 'high'],
  ] as const)('maps score %i to %s', (score, level) => {
    expect(riskLevelFor(score)).toBe(level);
  });
});

describe('AnswersSchema (server-side validation)', () => {
  it('accepts a complete, valid submission', () => {
    expect(AnswersSchema.safeParse(pick('worst')).success).toBe(true);
  });

  it('rejects a missing answer', () => {
    const { lumbar: _omit, ...rest } = pick('best');
    expect(AnswersSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects values that are not options', () => {
    expect(AnswersSchema.safeParse({ ...pick('best'), lumbar: 'maybe' }).success).toBe(false);
  });

  it('rejects unknown keys (e.g. a client-supplied score)', () => {
    expect(AnswersSchema.safeParse({ ...pick('best'), totalScore: 0 }).success).toBe(false);
  });

  it('rejects duplicate multi-select values', () => {
    expect(AnswersSchema.safeParse({ ...pick('best'), discomfort_areas: ['neck', 'neck'] }).success).toBe(false);
  });
});
