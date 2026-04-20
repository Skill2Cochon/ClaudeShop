import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuditLogRepository, InventoryRepository } from '@claudeshop/core';
import { recordFromRequest } from '../audit/record.js';

export interface AdminInventoryRoutesDeps {
  inventoryRepo: InventoryRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

const InventoryRowSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  productSlug: z.string(),
  productName: z.record(z.string()),
  sku: z.string(),
  locationId: z.string(),
  onHand: z.number().int(),
  reserved: z.number().int(),
  safetyStock: z.number().int(),
  available: z.number().int(),
  updatedAt: z.string(),
});

export async function registerAdminInventoryRoutes(
  app: FastifyInstance,
  deps: AdminInventoryRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/inventory',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
          lowOnly: z.coerce.boolean().optional(),
          outOfStockOnly: z.coerce.boolean().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(InventoryRowSchema),
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
      const { items, total } = await deps.inventoryRepo.listProjections(tenantId, {
        page,
        limit,
        ...(request.query.lowOnly !== undefined ? { lowOnly: request.query.lowOnly } : {}),
        ...(request.query.outOfStockOnly !== undefined
          ? { outOfStockOnly: request.query.outOfStockOnly }
          : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.get(
    '/v1/admin/inventory/summary',
    {
      schema: {
        response: {
          200: z.object({
            data: z.object({
              total: z.number().int(),
              outOfStock: z.number().int(),
              lowStock: z.number().int(),
              healthy: z.number().int(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const summary = await deps.inventoryRepo.summary(tenantId);
      return { data: summary };
    },
  );

  zApp.post(
    '/v1/admin/inventory/adjust',
    {
      schema: {
        body: z.object({
          variantId: z.string().min(1),
          delta: z.number().int(),
          reason: z.string().max(400).optional(),
        }),
        response: { 200: z.object({ data: z.object({ ok: z.literal(true) }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.inventoryRepo.adjustStock(tenantId, {
        variantId: request.body.variantId,
        delta: request.body.delta,
        ...(request.body.reason !== undefined ? { reason: request.body.reason } : {}),
      });
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'inventory.adjust',
        resourceType: 'variant',
        resourceId: request.body.variantId,
        diff: {
          delta: request.body.delta,
          ...(request.body.reason !== undefined ? { reason: request.body.reason } : {}),
        },
      });
      return { data: { ok: true as const } };
    },
  );

  zApp.post(
    '/v1/admin/inventory/safety-stock',
    {
      schema: {
        body: z.object({
          variantId: z.string().min(1),
          safetyStock: z.number().int().min(0),
        }),
        response: { 200: z.object({ data: z.object({ ok: z.literal(true) }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.inventoryRepo.setSafetyStock(tenantId, {
        variantId: request.body.variantId,
        safetyStock: request.body.safetyStock,
      });
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'inventory.safety_stock.set',
        resourceType: 'variant',
        resourceId: request.body.variantId,
        diff: { safetyStock: request.body.safetyStock },
      });
      return { data: { ok: true as const } };
    },
  );
}
