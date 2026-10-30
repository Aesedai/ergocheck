import { Link } from 'react-router-dom';
import { api } from '../api';
import { RiskBadge } from '../components/RiskBadge';
import { formatDate } from '../format';
import { useFetch } from '../useFetch';

export function HistoryPage() {
  const { data, loading, error } = useFetch(() => api.listAssessments(), []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>My assessments</h1>
          <p className="muted">Only you can see your individual results.</p>
        </div>
        <Link className="btn btn-primary" to="/assess">New assessment</Link>
      </header>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{error.message}</p>}
      {data && data.length === 0 && (
        <div className="card empty">
          <p>No assessments yet.</p>
          <Link className="btn btn-primary" to="/assess">Take your first assessment</Link>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
                <th>Risk</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.createdAt)}</td>
                  <td className="num">{a.totalScore}</td>
                  <td><RiskBadge level={a.riskLevel} short /></td>
                  <td className="right"><Link to={`/assessments/${a.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
