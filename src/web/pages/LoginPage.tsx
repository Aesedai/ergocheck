import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ThemeToggle } from '../theme';

const DEMO_PASSWORD = 'ergocheck-demo';
const DEMO_ACCOUNTS = [
  { email: 'alex@harborpine.example', label: 'Member', org: 'Harbor & Pine Insurance' },
  { email: 'dana@harborpine.example', label: 'Org admin', org: 'Harbor & Pine Insurance' },
  { email: 'luis@cobaltfreight.example', label: 'Org admin', org: 'Cobalt Freight Co.' },
];

export function LoginPage() {
  const { me, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <ThemeToggle className="auth-theme" />
      <section className="auth-hero">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden>✓</span> ErgoCheck
        </div>
        <h1>Workstation ergonomics, measured.</h1>
        <p>A two-minute self-assessment that turns how you sit and work into a clear risk score and practical next steps — with an organization-wide view for health &amp; safety leads.</p>
      </section>

      <section className="auth-panel">
        <form className="card" onSubmit={submit}>
          <h2>Sign in</h2>
          <label>
            Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="card demo-card">
          <h3>Demo accounts</h3>
          <p className="muted">
            Password for all: <code>{DEMO_PASSWORD}</code>. Click one to fill the form.
          </p>
          <ul className="demo-list">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="demo-account"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                >
                  <span className={`pill ${a.label === 'Member' ? '' : 'pill-admin'}`}>{a.label}</span>
                  <span className="demo-email">{a.email}</span>
                  <span className="muted small">{a.org}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
