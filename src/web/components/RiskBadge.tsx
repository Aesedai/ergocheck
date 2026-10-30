import type { RiskLevel } from '../../shared/scoring';

const LABELS: Record<RiskLevel, string> = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };

export function RiskBadge({ level, short = false }: { level: RiskLevel; short?: boolean }) {
  return <span className={`risk risk-${level}`}>{short ? level[0]!.toUpperCase() + level.slice(1) : LABELS[level]}</span>;
}
