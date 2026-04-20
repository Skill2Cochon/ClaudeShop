import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateSegmentInputSchema,
  CustomerSegmentSchema,
  UpdateSegmentInputSchema,
} from '@claudeshop/contracts/crm';
import {
  SystemClock,
  computeSegmentMembers,
  type CustomerRepository,
  type CustomerSegmentRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface SegmentRoutesDeps {
  repo: CustomerSegmentRepository;
  customerRepo: CustomerRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerSegmentRoutes(
  app: FastifyInstance,
  deps: SegmentRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  zApp.get(
    '/v1/admin/segments',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(CustomerSegmentSchema),
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
      const { items, total } = await deps.repo.list(tenantId, { page, limit });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/segments',
    {
      schema: {
        body: CreateSegmentInputSchema,
        response: { 201: z.object({ data: CustomerSegmentSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const segment = await deps.repo.create(tenantId, request.body);
      return reply.status(201).send({ data: segment });
    },
  );

  zApp.get(
    '/v1/admin/segments/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: CustomerSegmentSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const segment = await deps.repo.findById(tenantId, request.params.id);
      if (!segment) throw new NotFoundError(`Segment ${request.params.id} not found`);
      return { data: segment };
    },
  );

  zApp.patch(
    '/v1/admin/segments/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateSegmentInputSchema,
        response: { 200: z.object({ data: CustomerSegmentSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const segment = await deps.repo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: segment };
    },
  );

  zApp.delete(
    '/v1/admin/segments/:id',
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

  zApp.post(
    '/v1/admin/segments/:id/refresh',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: z.object({
            data: z.object({
              segmentId: z.string(),
              customerCount: z.number(),
              refreshedAt: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const result = await computeSegmentMembers(request.params.id, {
        tenantId,
        segmentRepo: deps.repo,
        customerRepo: deps.customerRepo,
        clock,
      });
      return { data: result };
    },
  );
}
