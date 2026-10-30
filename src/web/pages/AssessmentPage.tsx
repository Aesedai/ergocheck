import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AREAS, AREA_LABELS, QUESTIONS } from '../../shared/questions';
import type { Answers } from '../../shared/scoring';
import { api } from '../api';

export function AssessmentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answers>({ discomfort_areas: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const answered = QUESTIONS.filter((q) => q.kind === 'multi' || answers[q.id] !== undefined).length;
  const complete = answered === QUESTIONS.length;

  const setSingle = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }));
  const toggleMulti = (id: string, value: string) =>
    setAnswers((a) => {
      const current = (a[id] as string[] | undefined) ?? [];
      return { ...a, [id]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.submitAssessment(answers);
      navigate(`/assessments/${created.id}`, { state: { justSubmitted: true } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="assessment" onSubmit={submit}>
      <header className="page-head">
        <div>
          <h1>Workstation self-assessment</h1>
          <p className="muted">About two minutes. Answer for how you usually work.</p>
        </div>
        <div className="progress" aria-label={`${answered} of ${QUESTIONS.length} answered`}>
          <span style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
        </div>
      </header>

      {AREAS.map((area, i) => (
        <fieldset key={area} className="card area-section">
          <legend>
            <span className="step">{i + 1}</span> {AREA_LABELS[area]}
          </legend>
          {QUESTIONS.filter((q) => q.area === area).map((q) => (
            <div key={q.id} className="question" role={q.kind === 'single' ? 'radiogroup' : 'group'} aria-label={q.prompt}>
              <p className="question-prompt">{q.prompt}</p>
              <div className="options">
                {q.options.map((o) => {
                  const checked =
                    q.kind === 'multi' ? ((answers[q.id] as string[] | undefined) ?? []).includes(o.value) : answers[q.id] === o.value;
                  return (
                    <label key={o.value} className={`option ${checked ? 'option-on' : ''}`}>
                      <input
                        type={q.kind === 'multi' ? 'checkbox' : 'radio'}
                        name={q.id}
                        value={o.value}
                        checked={checked}
                        onChange={() => (q.kind === 'multi' ? toggleMulti(q.id, o.value) : setSingle(q.id, o.value))}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>
      ))}

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="submit-bar">
        <span className="muted small">
          {complete ? 'All questions answered.' : `${QUESTIONS.length - answered} question(s) left`}
        </span>
        <button className="btn btn-primary" disabled={!complete || busy}>
          {busy ? 'Scoring…' : 'See my results'}
        </button>
      </div>
    </form>
  );
}
