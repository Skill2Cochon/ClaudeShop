import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { toCsv, type AuditLogRepository } from '@claudeshop/core';

export interface AdminAuditLogExportRoutesDeps {
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 45 — CSV export for the admin audit trail. Fourth export in
 * the set alongside orders / customers / products. Shape mirrors
 * GET /v1/admin/audit-logs (actorType / action / resourceType /
 * resourceId / actorId / since / until). 10 000-row cap — audit
 * exports are typically a regulator asking for "everything in Q2",
 * so we give them 2x the per-month headroom of the commerce
 * exports but still draw a line so a misconfigured query can't
 * drain the whole table.
 *
 * diff is serialised as compact JSON in a single cell. That keeps
 * the file openable in Excel; analysts who want richer shape can
 * hit the JSON API directly.
 */
export async function registerAdminAuditLogExportRoutes(
  app: FastifyInstance,
  deps: AdminAuditLogExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/audit-logs/export.csv',
    {
      schema: {
        querystring: z.object({
          actorType: z
            .enum(['user', 'copilot', 'system', 'api-key'])
            .optional(),
          action: z.string().trim().min(1).max(120).optional(),
          resourceType: z.string().trim().min(1).max(64).optional(),
          resourceId: z.string().trim().min(1).max(120).optional(),
          actorId: z.string().trim().min(1).max(120).optional(),
          since: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          until: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const since = request.query.since
        ? `${request.query.since}T00:00:00.000Z`
        : undefined;
      const until = request.query.until
        ? `${request.query.until}T23:59:59.999Z`
        : undefined;

      const EXPORT_LIMIT = 10_000;
      const { items } = await deps.auditLogRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.actorType ? { actorType: request.query.actorType } : {}),
        ...(request.query.action ? { action: request.query.action } : {}),
        ...(request.query.resourceType
          ? { resourceType: request.query.resourceType }
          : {}),
        ...(request.query.resourceId
          ? { resourceId: request.query.resourceId }
          : {}),
        ...(request.query.actorId ? { actorId: request.query.actorId } : {}),
        ...(since ? { since } : {}),
        ...(until ? { until } : {}),
      });

      const rows = items.map((entry) => ({
        id: entry.id,
        created_at: entry.createdAt,
        actor_type: entry.actorType,
        actor_id: entry.actorId ?? '',
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        // JSON.stringify(undefined) is undefined, which would bleed
        // through to the CSV as an empty cell. Explicit '' for
        // null/undefined keeps the column stable.
        diff:
          entry.diff === null || entry.diff === undefined
            ? ''
            : JSON.stringify(entry.diff),
        ip: entry.ip ?? '',
        user_agent: entry.userAgent ?? '',
        request_id: entry.requestId ?? '',
      }));

      const csv = toCsv(rows, {
        columns: [
          'id',
          'created_at',
          'actor_type',
          'actor_id',
          'action',
          'resource_type',
          'resource_id',
          'diff',
          'ip',
          'user_agent',
          'request_id',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `audit-logs-${today}.csv`;
      const BOM = '\ufeff';

      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header(
          'content-disposition',
          `attachment; filename="${filename}"`,
        )
        .send(BOM + csv);
    },
  );
}
