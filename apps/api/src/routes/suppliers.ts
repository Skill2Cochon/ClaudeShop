import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateSupplierInputSchema,
  SupplierSchema,
  UpdateSupplierInputSchema,
} from '@claudeshop/contracts/erp';
import type { SupplierRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface SupplierRoutesDeps {
  repo: SupplierRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerSupplierRoutes(
  app: FastifyInstance,
  deps: SupplierRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/suppliers',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          isActive: z.enum(['true', 'false']).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(SupplierSchema),
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
      const isActive =
        request.query.isActive === undefined
          ? undefined
          : request.query.isActive === 'true';
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        ...(isActive !== undefined ? { isActive } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/suppliers',
    {
      schema: {
        body: CreateSupplierInputSchema,
        response: { 201: z.object({ data: SupplierSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const supplier = await deps.repo.create(tenantId, request.body);
      return reply.status(201).send({ data: supplier });
    },
  );

  zApp.get(
    '/v1/admin/suppliers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: SupplierSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const supplier = await deps.repo.findById(tenantId, request.params.id);
      if (!supplier) throw new NotFoundError(`Supplier ${request.params.id} not found`);
      return { data: supplier };
    },
  );

  zApp.patch(
    '/v1/admin/suppliers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateSupplierInputSchema,
        response: { 200: z.object({ data: SupplierSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const supplier = await deps.repo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: supplier };
    },
  );

  zApp.delete(
    '/v1/admin/suppliers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: z.object({ deleted: z.boolean() }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.repo.delete(tenantId, request.params.id);
      return { data: { deleted: true } };
    },
  );
}
