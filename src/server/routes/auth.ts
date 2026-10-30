import type { FastifyInstance } from 'fastify';
import { LoginRequest } from '../../shared/api.js';
import {
  SESSION_COOKIE,
  createSession,
  currentUser,
  destroySession,
  requireAuth,
  toMe,
  userForSession,
  verifyCredentials,
} from '../auth.js';
import { parseBody } from '../validate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const body = parseBody(LoginRequest, req.body);
    const userId = await verifyCredentials(body.email, body.password);
    if (!userId) return reply.code(401).send({ error: 'Invalid email or password' });

    const { token, expiresAt } = await createSession(userId);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    const user = await userForSession(token);
    return toMe(user!);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => toMe(currentUser(req)));
}
