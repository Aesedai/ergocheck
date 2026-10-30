import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { RiskBadge } from '../components/RiskBadge';
import { formatDate } from '../format';
import { useFetch } from '../useFetch';

export function HomePage() {
  const { me } = useAuth();
  const { data } = useFetch(() => api.listAssessments(), []);
  const latest = data?.[0];
  const trend = data && data.length > 1 ? data[0]!.totalScore - data[1]!.totalScore : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Hi, {me!.user.displayName.split(' ')[0]}</h1>
          <p className="muted">{me!.org.name}</p>
        </div>
      </header>

      <div className="home-grid">
        <section className="card cta-card">
          <h2>Check your workstation</h2>
          <p className="muted">Twelve quick questions about your chair, screen, keyboard, breaks and any discomfort. You’ll get a risk score and specific adjustments to make.</p>
          <Link className="btn btn-primary" to="/assess">Start assessment</Link>
        </section>

        <section className="card">
          <h2>Your latest result</h2>
          {!data && <p className="muted">Loading…</p>}
          {data && !latest && <p className="muted">You haven’t taken an assessment yet.</p>}
          {latest && (
            <>
              <div className="latest">
                <span className="latest-score">{latest.totalScore}</span>
                <div>
                  <RiskBadge level={latest.riskLevel} />
                  <p className="muted small">{formatDate(latest.createdAt)}</p>
                </div>
              </div>
              {trend !== null && trend !== 0 && (
                <p className="small">
                  {trend < 0 ? `▼ ${-trend} points lower` : `▲ ${trend} points higher`} than your previous assessment.
                </p>
              )}
              <Link to={`/assessments/${latest.id}`}>View details</Link> · <Link to="/history">History</Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
