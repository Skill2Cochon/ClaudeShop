import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreatePurchaseOrderInputSchema,
  PurchaseOrderSchema,
  PurchaseOrderStatusSchema,
  ReceivePurchaseOrderInputSchema,
} from '@claudeshop/contracts/erp';
import {
  SystemClock,
  createPurchaseOrder,
  receivePurchaseOrder,
  type InventoryRepository,
  type PurchaseOrderRepository,
  type SupplierRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface PurchaseOrderRoutesDeps {
  repo: PurchaseOrderRepository;
  supplierRepo: SupplierRepository;
  inventoryRepo: InventoryRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerPurchaseOrderRoutes(
  app: FastifyInstance,
  deps: PurchaseOrderRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  zApp.get(
    '/v1/admin/purchase-orders',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: PurchaseOrderStatusSchema.optional(),
          supplierId: z.string().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(PurchaseOrderSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
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
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        ...(request.query.status ? { status: request.query.status } : {}),
        ...(request.query.supplierId ? { supplierId: request.query.supplierId } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/purchase-orders',
    {
      schema: {
        body: CreatePurchaseOrderInputSchema,
        response: { 201: z.object({ data: PurchaseOrderSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const po = await createPurchaseOrder(request.body, {
        tenantId,
        supplierRepo: deps.supplierRepo,
        repo: deps.repo,
        clock,
      });
      return reply.status(201).send({ data: po });
    },
  );

  zApp.get(
    '/v1/admin/purchase-orders/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: PurchaseOrderSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const po = await deps.repo.findById(tenantId, request.params.id);
      if (!po) throw new NotFoundError(`Purchase order ${request.params.id} not found`);
      return { data: po };
    },
  );

  // Status transitions ------------------------------------------------------

  zApp.post(
    '/v1/admin/purchase-orders/:id/send',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: PurchaseOrderSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const po = await deps.repo.updateStatus(tenantId, request.params.id, 'SENT', {
        placedAt: new Date(),
      });
      return { data: po };
    },
  );

  zApp.post(
    '/v1/admin/purchase-orders/:id/cancel',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: PurchaseOrderSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const po = await deps.repo.updateStatus(tenantId, request.params.id, 'CANCELLED');
      return { data: po };
    },
  );

  zApp.post(
    '/v1/admin/purchase-orders/:id/receive',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: ReceivePurchaseOrderInputSchema,
        response: { 200: z.object({ data: PurchaseOrderSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const po = await receivePurchaseOrder(request.params.id, request.body, {
        tenantId,
        repo: deps.repo,
        inventoryRepo: deps.inventoryRepo,
        clock,
      });
      return { data: po };
    },
  );
}
