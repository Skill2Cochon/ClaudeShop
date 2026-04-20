import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuditLogRepository } from '@claudeshop/core';

export interface AdminAuditLogRoutesDeps {
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

const EntrySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  actorType: z.enum(['user', 'copilot', 'system', 'api-key']),
  actorId: z.string().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  diff: z.unknown(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.string(),
});

export async function registerAdminAuditLogRoutes(
  app: FastifyInstance,
  deps: AdminAuditLogRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/audit-logs',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
          actorType: z.enum(['user', 'copilot', 'system', 'api-key']).optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          resourceId: z.string().optional(),
          actorId: z.string().optional(),
          since: z.string().datetime().optional(),
          until: z.string().datetime().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(EntrySchema),
            meta: z.object({
              page: z.number().int(),
              limit: z.number().int(),
              total: z.number().int(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 50;
      const { items, total } = await deps.auditLogRepo.list(tenantId, {
        page,
        limit,
        ...(request.query.actorType ? { actorType: request.query.actorType } : {}),
        ...(request.query.action ? { action: request.query.action } : {}),
        ...(request.query.resourceType ? { resourceType: request.query.resourceType } : {}),
        ...(request.query.resourceId ? { resourceId: request.query.resourceId } : {}),
        ...(request.query.actorId ? { actorId: request.query.actorId } : {}),
        ...(request.query.since ? { since: request.query.since } : {}),
        ...(request.query.until ? { until: request.query.until } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );
}
