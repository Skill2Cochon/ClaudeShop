/**
 * Audit trail — append-only. Each mutation of material state in the platform
 * records one AuditLog row. Rows never mutate or delete; enforcement is
 * expected at the DB layer (role GRANTs / RLS) but the port does not rely
 * on that and will accept UPDATE/DELETE requests only through a future
 * retention job.
 */

export type AuditActorType = 'user' | 'copilot' | 'system' | 'api-key';

export interface AppendAuditLogInput {
  actorType: AuditActorType;
  actorId?: string | null;
  /** Verb + qualifier, e.g. "module.install", "inventory.adjust". */
  action: string;
  resourceType: string;
  resourceId: string;
  /** Free-form JSON diff / payload hash / reason. Never PII-heavy. */
  diff?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface ListAuditLogsOptions {
  page: number;
  limit: number;
  actorType?: AuditActorType;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  /** ISO-8601 lower bound (inclusive). */
  since?: string;
  /** ISO-8601 upper bound (inclusive). */
  until?: string;
}

export interface AuditLogRepository {
  append(tenantId: string, input: AppendAuditLogInput): Promise<AuditLogEntry>;
  list(
    tenantId: string,
    opts: ListAuditLogsOptions,
  ): Promise<{ items: AuditLogEntry[]; total: number }>;
}
