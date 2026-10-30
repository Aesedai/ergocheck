import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';

export function Layout() {
  const { me, loading, logout } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>✓</span> ErgoCheck
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/assess">Assess</NavLink>
            <NavLink to="/history">History</NavLink>
          </nav>
          <div className="whoami">
            <span className="whoami-name">{me.user.displayName}</span>
            <span className="muted small">
              {me.org.name}
              {me.user.role === 'org_admin' && ' · Admin'}
            </span>
          </div>
          <button className="btn btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
