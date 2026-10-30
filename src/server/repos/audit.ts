import type { AuditEvent } from '../../shared/api.js';
import type { TenantContext, Tx } from '../db.js';

export async function listAuditEvents(tx: Tx, ctx: TenantContext, limit = 50): Promise<AuditEvent[]> {
  const { rows } = await tx.query<{
    id: string;
    action: string;
    entity_type: string | null;
    actor_name: string | null;
    created_at: Date;
  }>(
    `SELECT a.id, a.action, a.entity_type, u.display_name AS actor_name, a.created_at
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id AND u.org_id = a.org_id
      WHERE a.org_id = $1
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $2`,
    [ctx.orgId, limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    action: r.action,
    entityType: r.entity_type,
    actorName: r.actor_name,
    createdAt: r.created_at.toISOString(),
  }));
}
