import type { FastifyInstance } from 'fastify';
import { audit } from '../audit.js';
import { currentUser, requireAuth, requireRole } from '../auth.js';
import { withTenant } from '../db.js';
import { listAuditEvents } from '../repos/audit.js';
import { getOrgSummary } from '../repos/orgSummary.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireRole('org_admin'));

  // The org is always the admin's own (from the session) — there is no org id
  // parameter a caller could change to point at another tenant.
  app.get('/api/admin/summary', async (req) => {
    const user = currentUser(req);
    return withTenant(user, async (tx) => {
      await audit(tx, user, req, { action: 'admin.summary.view' });
      return getOrgSummary(tx, user);
    });
  });

  app.get('/api/admin/audit', async (req) => {
    const user = currentUser(req);
    return withTenant(user, async (tx) => {
      const events = await listAuditEvents(tx, user);
      await audit(tx, user, req, { action: 'admin.audit.view' });
      return events;
    });
  });
}
