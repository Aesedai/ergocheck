import { api } from '../api';
import { useFetch } from '../useFetch';

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout': 'Signed out',
  'assessment.create': 'Submitted an assessment',
  'assessment.view': 'Viewed own assessment',
  'admin.summary.view': 'Viewed organization overview',
  'admin.audit.view': 'Viewed audit log',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function AuditLog() {
  const { data, error, loading } = useFetch(() => api.auditLog(), []);
  return (
    <section className="card table-card">
      <div className="table-card-head">
        <h2>Recent activity</h2>
        <p className="muted small">Append-only audit trail for this organization. Shows who did what — never assessment content.</p>
      </div>
      {loading && <p className="muted pad">Loading…</p>}
      {error && <p className="form-error pad">{error.message}</p>}
      {data && data.length === 0 && <p className="muted pad">No activity yet.</p>}
      {data && data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((e) => (
              <tr key={e.id}>
                <td className="nowrap muted">{formatTime(e.createdAt)}</td>
                <td>{e.actorName ?? '—'}</td>
                <td className={e.action === 'auth.login_failed' ? 'tone-high' : undefined}>{ACTION_LABELS[e.action] ?? e.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
