import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ApplyPromotionInputSchema,
  AppliedPromotionSchema,
  CreatePromotionInputSchema,
  PromotionStatusSchema,
  PromotionSchema,
  UpdatePromotionInputSchema,
} from '@claudeshop/contracts/promotion';
import {
  SystemClock,
  applyPromotion,
  type PromotionRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface PromotionRoutesDeps {
  repo: PromotionRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerPromotionRoutes(
  app: FastifyInstance,
  deps: PromotionRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  // --- Public: POST /v1/promotions/apply ----------------------------------
  zApp.post(
    '/v1/promotions/apply',
    {
      schema: {
        body: ApplyPromotionInputSchema,
        response: { 200: z.object({ data: AppliedPromotionSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const applied = await applyPromotion(request.body, {
        tenantId,
        repo: deps.repo,
        clock,
      });
      return { data: applied };
    },
  );

  // --- Admin: GET /v1/admin/promotions ------------------------------------
  zApp.get(
    '/v1/admin/promotions',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: PromotionStatusSchema.optional(),
        }),
        response: {
          200: z.object({
            data: z.array(PromotionSchema),
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
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  // --- Admin: POST /v1/admin/promotions -----------------------------------
  zApp.post(
    '/v1/admin/promotions',
    {
      schema: {
        body: CreatePromotionInputSchema,
        response: { 201: z.object({ data: PromotionSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const promotion = await deps.repo.create(tenantId, request.body);
      return reply.status(201).send({ data: promotion });
    },
  );

  // --- Admin: GET /v1/admin/promotions/:id --------------------------------
  zApp.get(
    '/v1/admin/promotions/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: PromotionSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const promotion = await deps.repo.findById(tenantId, request.params.id);
      if (!promotion) throw new NotFoundError(`Promotion ${request.params.id} not found`);
      return { data: promotion };
    },
  );

  // --- Admin: PATCH /v1/admin/promotions/:id ------------------------------
  zApp.patch(
    '/v1/admin/promotions/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdatePromotionInputSchema,
        response: { 200: z.object({ data: PromotionSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const promotion = await deps.repo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: promotion };
    },
  );

  // --- Admin: DELETE /v1/admin/promotions/:id -----------------------------
  zApp.delete(
    '/v1/admin/promotions/:id',
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
