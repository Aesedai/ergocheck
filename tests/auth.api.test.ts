import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../src/server/db.js';
import { PASSWORD, createOrgWithUsers, login, testApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

const app = testApp();
let org: Awaited<ReturnType<typeof createOrgWithUsers>>;

beforeAll(async () => {
  await resetDb();
  org = await createOrgWithUsers('Acme');
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('auth', () => {
  it('logs in, sets an httpOnly session cookie and returns the user + org', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: org.member.email.toUpperCase(), password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: org.member.email, role: 'member' }, org: { name: 'Acme' } });
    const cookie = res.cookies.find((c) => c.name === 'ec_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
  });

  it('stores only a hash of the session token', async () => {
    const cookie = await login(app, org.member.email);
    const token = cookie.split('=')[1];
    const { rows } = await getPool().query('SELECT 1 FROM sessions WHERE token_hash = $1', [token]);
    expect(rows).toHaveLength(0);
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: org.member.email, password: 'nope' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ghost@acme.example', password: 'nope' } });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it('validates the login body server-side', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'not-an-email' } });
    expect(res.statusCode).toBe(400);
  });

  it('requires a session for /me and returns the user with one', async () => {
    expect((await app.inject({ url: '/api/auth/me' })).statusCode).toBe(401);
    const cookie = await login(app, org.admin.email);
    const me = await app.inject({ url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.role).toBe('org_admin');
  });

  it('invalidates the session on logout', async () => {
    const cookie = await login(app, org.member.email);
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('rejects an expired session', async () => {
    const cookie = await login(app, org.member.email);
    await getPool().query("UPDATE sessions SET expires_at = now() - interval '1 minute'");
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });
});
