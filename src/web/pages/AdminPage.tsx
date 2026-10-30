import { Navigate } from 'react-router-dom';
import type { OrgSummary } from '../../shared/api';
import { AREA_LABELS } from '../../shared/questions';
import { riskLevelFor, type RiskLevel } from '../../shared/scoring';
import { api } from '../api';
import { useAuth } from '../auth';
import { RiskBadge } from '../components/RiskBadge';
import { useFetch } from '../useFetch';

const LEVELS: RiskLevel[] = ['high', 'moderate', 'low'];

export function AdminPage() {
  const { me } = useAuth();
  // UI convenience only — the API enforces the role on every request.
  if (me?.user.role !== 'org_admin') return <Navigate to="/" replace />;
  return <AdminDashboard orgName={me.org.name} />;
}

function AdminDashboard({ orgName }: { orgName: string }) {
  const { data, error, loading } = useFetch(() => api.orgSummary(), []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Organization overview</h1>
          <p className="muted">{orgName} · aggregate data only — individual results stay private to each employee.</p>
        </div>
      </header>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{error.message}</p>}
      {data && <Dashboard s={data} />}
    </>
  );
}

function Dashboard({ s }: { s: OrgSummary }) {
  const participation = s.people ? Math.round((s.participants / s.people) * 100) : 0;
  const h = s.health;
  const riskTotal = h ? LEVELS.reduce((n, l) => n + h.latestRisk[l], 0) : 0;
  const maxMonthly = Math.max(1, ...s.monthly.map((m) => m.assessments));

  return (
    <div className="admin">
      <section className="stats">
        <Stat label="Participation" value={`${participation}%`} hint={`${s.participants} of ${s.people} people`} />
        <Stat label="Assessments" value={String(s.assessments)} hint="all time" />
        <Stat label="Average score" value={h ? String(h.averageScore) : '—'} hint="0 = lowest risk" />
        <Stat label="Currently high risk" value={h ? String(h.latestRisk.high) : '—'} hint="by latest assessment" tone={h?.latestRisk.high ? 'high' : undefined} />
      </section>

      {!h && (
        <section className="card notice">
          <h2>Not enough participants yet</h2>
          <p className="muted">
            Risk breakdowns appear once at least {s.minGroupSize} people have completed an assessment ({s.participants} so far). In smaller
            groups, figures like “1 high risk” could identify an individual.
          </p>
        </section>
      )}

      {h && (
        <>
          <section className="card">
            <h2>Current risk distribution</h2>
            <p className="muted small">Each participant counted once, by their most recent assessment.</p>
            {riskTotal === 0 ? (
              <p className="muted">No assessments yet.</p>
            ) : (
              <>
                <div className="stack" role="img" aria-label={LEVELS.map((l) => `${h.latestRisk[l]} ${l}`).join(', ')}>
                  {LEVELS.filter((l) => h.latestRisk[l] > 0).map((l) => (
                    <span key={l} className={`stack-seg bar-${l}`} style={{ flexGrow: h.latestRisk[l] }}>
                      {h.latestRisk[l]}
                    </span>
                  ))}
                </div>
                <ul className="legend">
                  {LEVELS.map((l) => (
                    <li key={l}>
                      <RiskBadge level={l} short /> {h.latestRisk[l]} ({Math.round((h.latestRisk[l] / riskTotal) * 100)}%)
                    </li>
                  ))}
                </ul>
          </>
        )}
      </section>
        </>
      )}

      <div className={h ? 'admin-grid' : undefined}>
        {h && (
          <section className="card">
            <h2>Where risk concentrates</h2>
            <p className="muted small">Average area score across participants’ latest assessments.</p>
            <ul className="area-bars">
              {h.areas.map((a) => {
                const level = riskLevelFor(a.averageScore);
                return (
                  <li key={a.area}>
                    <span className="area-bars-label">{AREA_LABELS[a.area]}</span>
                    <div className="bar">
                      <span className={`bar-fill bar-${level}`} style={{ width: `${Math.max(a.averageScore, 2)}%` }} />
                    </div>
                    <span className="num">{a.averageScore}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Activity</h2>
          <p className="muted small">Assessments completed per month.</p>
          <div className="months">
            {s.monthly.map((m) => (
              <div key={m.month} className="month">
                <span className="month-n">{m.assessments || ''}</span>
                <span className="month-bar" style={{ height: `${(m.assessments / maxMonthly) * 100}%` }} />
                <span className="month-label">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: RiskLevel }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</span>
      <span className="muted small">{hint}</span>
    </div>
  );
}
