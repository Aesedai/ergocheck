import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { adminRoutes } from './routes/admin.js';
import { assessmentRoutes } from './routes/assessments.js';
import { authRoutes } from './routes/auth.js';
import { ValidationError } from './validate.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.register(cookie);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ValidationError) {
      return reply.code(400).send({ error: err.message, details: err.details });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.get('/api/health', async () => ({ ok: true }));
  app.register(authRoutes);
  app.register(assessmentRoutes);
  app.register(adminRoutes);

  return app;
}
