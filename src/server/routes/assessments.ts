import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SubmitAssessmentRequest } from '../../shared/api.js';
import { scoreAssessment } from '../../shared/scoring.js';
import { currentUser, requireAuth } from '../auth.js';
import { withTenant } from '../db.js';
import { getOwnAssessment, insertAssessment, listOwnAssessments } from '../repos/assessments.js';
import { parseBody } from '../validate.js';

const IdParams = z.object({ id: z.string().uuid() });

export async function assessmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/api/assessments', async (req, reply) => {
    const { answers } = parseBody(SubmitAssessmentRequest, req.body);
    // Score on the server from validated answers only; nothing score-related is accepted from the client.
    const result = scoreAssessment(answers);
    const user = currentUser(req);
    const created = await withTenant(user, (tx) => insertAssessment(tx, user, answers, result));
    return reply.code(201).send(created);
  });

  app.get('/api/assessments', async (req) => {
    const user = currentUser(req);
    return withTenant(user, (tx) => listOwnAssessments(tx, user));
  });

  app.get('/api/assessments/:id', async (req, reply) => {
    const parsed = IdParams.safeParse(req.params);
    if (!parsed.success) return reply.code(404).send({ error: 'Not found' });
    const user = currentUser(req);
    const found = await withTenant(user, (tx) => getOwnAssessment(tx, user, parsed.data.id));
    // 404 (not 403) for other users' or other orgs' assessments: don't confirm they exist.
    return found ?? reply.code(404).send({ error: 'Not found' });
  });
}
