import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Me } from '../shared/api.js';
import type { Role } from '../shared/types.js';
import { getPool, type TenantContext } from './db.js';

export const SESSION_COOKIE = 'ec_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Compared against when the email is unknown so a failed login takes the same
// time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export interface AuthedUser extends TenantContext {
  email: string;
  displayName: string;
  orgName: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function verifyCredentials(email: string, password: string): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  return ok && user ? user.id : null;
}

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getPool().query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await getPool().query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function userForSession(token: string): Promise<AuthedUser | null> {
  const { rows } = await getPool().query<{
    user_id: string;
    org_id: string;
    role: Role;
    email: string;
    display_name: string;
    org_name: string;
  }>(
    `SELECT u.id AS user_id, u.org_id, u.role, u.email, u.display_name, o.name AS org_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN organizations o ON o.id = u.org_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role,
    email: r.email,
    displayName: r.display_name,
    orgName: r.org_name,
  };
}

export function toMe(u: AuthedUser): Me {
  return {
    user: { id: u.userId, email: u.email, displayName: u.displayName, role: u.role },
    org: { id: u.orgId, name: u.orgName },
  };
}

/** preHandler: resolves the session cookie to a user or replies 401. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  const user = token ? await userForSession(token) : null;
  if (!user) {
    await reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  req.user = user;
}

/** preHandler factory: 403 unless the authenticated user has one of the roles. */
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user || !roles.includes(req.user.role)) {
      await reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

/** The authenticated user; only call from routes guarded by requireAuth. */
export function currentUser(req: FastifyRequest): AuthedUser {
  if (!req.user) throw new Error('route is missing requireAuth');
  return req.user;
}
