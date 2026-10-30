import { AREA_LABELS } from '../../shared/questions';
import type { ScoringResult } from '../../shared/scoring';
import { RiskBadge } from './RiskBadge';

const SUMMARY = {
  low: 'Your workstation setup and habits look healthy. Keep it up and re-check if anything changes.',
  moderate: 'A few adjustments would meaningfully lower your risk of strain. Start with the areas flagged below.',
  high: 'Several risk factors stand out. Work through the guidance below and consider raising it with your health & safety lead.',
} as const;

export function ResultsView({ result }: { result: ScoringResult }) {
  const flagged = [...result.areas].sort((a, b) => b.score - a.score);
  return (
    <div className="results">
      <section className={`card score-card score-${result.riskLevel}`}>
        <div className="score-ring" style={{ '--pct': `${result.totalScore}%` } as React.CSSProperties}>
          <span className="score-num">{result.totalScore}</span>
          <span className="score-of">/ 100</span>
        </div>
        <div>
          <RiskBadge level={result.riskLevel} />
          <p className="score-summary">{SUMMARY[result.riskLevel]}</p>
          <p className="muted small">Higher scores mean more ergonomic risk. Discomfort you report counts double.</p>
        </div>
      </section>

      <section className="area-grid">
        {flagged.map((a) => (
          <article key={a.area} className="card area-card">
            <header className="area-head">
              <h3>{AREA_LABELS[a.area]}</h3>
              <RiskBadge level={a.level} short />
            </header>
            <div className="bar" aria-label={`${a.score} out of 100`}>
              <span className={`bar-fill bar-${a.level}`} style={{ width: `${Math.max(a.score, 2)}%` }} />
            </div>
            {a.tips.length > 0 ? (
              <ul className="tips">
                {a.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No issues flagged here.</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
