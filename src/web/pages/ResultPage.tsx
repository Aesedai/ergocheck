import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { ResultsView } from '../components/ResultsView';
import { formatDate } from '../format';
import { useFetch } from '../useFetch';

export function ResultPage() {
  const { id = '' } = useParams();
  const justSubmitted = (useLocation().state as { justSubmitted?: boolean } | null)?.justSubmitted;
  const { data, error, loading } = useFetch(() => api.getAssessment(id), [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error || !data)
    return (
      <div className="card">
        <h2>Assessment not found</h2>
        <p className="muted">It may belong to someone else, or the link is wrong.</p>
        <Link to="/history">Back to history</Link>
      </div>
    );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{justSubmitted ? 'Your results' : 'Assessment results'}</h1>
          <p className="muted">Completed {formatDate(data.createdAt)}</p>
        </div>
        <Link className="btn btn-ghost" to="/history">All assessments</Link>
      </header>
      <ResultsView result={data.result} />
    </>
  );
}
