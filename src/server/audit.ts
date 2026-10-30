import type { FastifyRequest } from 'fastify';
import type { TenantContext, Tx } from './db.js';

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'assessment.create'
  | 'assessment.view'
  | 'admin.summary.view'
  | 'admin.audit.view';

interface AuditEntry {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an audit event inside the caller's tenant transaction, so the
 * event commits or rolls back together with the action it describes.
 */
export async function audit(tx: Tx, ctx: Pick<TenantContext, 'orgId'> & { userId: string | null }, req: FastifyRequest, entry: AuditEntry): Promise<void> {
  await tx.query(
    `INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id, ip, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.orgId, ctx.userId, entry.action, entry.entityType ?? null, entry.entityId ?? null, req.ip, JSON.stringify(entry.metadata ?? {})],
  );
}
