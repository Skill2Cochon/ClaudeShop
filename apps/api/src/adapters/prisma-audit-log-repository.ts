import type { PrismaClient } from '@claudeshop/db';
import type {
  AppendAuditLogInput,
  AuditActorType,
  AuditLogEntry,
  AuditLogRepository,
  ListAuditLogsOptions,
} from '@claudeshop/core';

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(tenantId: string, input: AppendAuditLogInput): Promise<AuditLogEntry> {
    const row = await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        diff: (input.diff ?? null) as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: ListAuditLogsOptions,
  ): Promise<{ items: AuditLogEntry[]; total: number }> {
    const page = Math.max(1, opts.page);
    const limit = Math.max(1, Math.min(opts.limit, 200));
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(opts.actorType ? { actorType: opts.actorType } : {}),
      ...(opts.action ? { action: opts.action } : {}),
      ...(opts.resourceType ? { resourceType: opts.resourceType } : {}),
      ...(opts.resourceId ? { resourceId: opts.resourceId } : {}),
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
      ...(opts.since || opts.until
        ? {
            createdAt: {
              ...(opts.since ? { gte: new Date(opts.since) } : {}),
              ...(opts.until ? { lte: new Date(opts.until) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }
}

type Row = {
  id: string;
  tenantId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
};

function toDomain(row: Row): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorType: row.actorType as AuditActorType,
    actorId: row.actorId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    diff: row.diff,
    ip: row.ip,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
