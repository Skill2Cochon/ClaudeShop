import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateReviewInputSchema,
  ReviewSchema,
  ReviewStatusSchema,
  ReviewSummarySchema,
} from '@claudeshop/contracts/review';
import { SlugSchema } from '@claudeshop/contracts/common';
import {
  moderateReview,
  submitReview,
  type ProductRepository,
  type ReviewRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface ReviewRoutesDeps {
  repo: ReviewRepository;
  productRepo: ProductRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerReviewRoutes(
  app: FastifyInstance,
  deps: ReviewRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  // --- Public: GET /v1/products/:slug/reviews -----------------------------
  zApp.get(
    '/v1/products/:slug/reviews',
    {
      schema: {
        params: z.object({ slug: SlugSchema }),
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(ReviewSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              summary: ReviewSummarySchema,
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const product = await deps.productRepo.findBySlug(tenantId, request.params.slug);
      if (!product) {
        throw new NotFoundError(`Product "${request.params.slug}" not found`);
      }
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const [{ items, total }, summary] = await Promise.all([
        deps.repo.listApprovedForProduct(tenantId, product.id, { page, limit }),
        deps.repo.summaryForProduct(tenantId, product.id),
      ]);
      return { data: items, meta: { page, limit, total, summary } };
    },
  );

  // --- Public: POST /v1/reviews -------------------------------------------
  zApp.post(
    '/v1/reviews',
    {
      schema: {
        body: CreateReviewInputSchema,
        response: { 201: z.object({ data: ReviewSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const review = await submitReview(request.body, {
        tenantId,
        productRepo: deps.productRepo,
        reviewRepo: deps.repo,
      });
      return reply.status(201).send({ data: review });
    },
  );

  // --- Admin moderation queue --------------------------------------------
  zApp.get(
    '/v1/admin/reviews',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: ReviewStatusSchema.optional(),
          productId: z.string().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(ReviewSchema),
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
        ...(request.query.productId ? { productId: request.query.productId } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/reviews/:id/moderate',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: z.object({
          status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
        }),
        response: { 200: z.object({ data: ReviewSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const review = await moderateReview(
        request.params.id,
        request.body.status,
        { tenantId, reviewRepo: deps.repo, now: () => new Date() },
      );
      return { data: review };
    },
  );

  zApp.delete(
    '/v1/admin/reviews/:id',
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
