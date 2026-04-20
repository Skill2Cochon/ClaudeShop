import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreatePageInputSchema,
  PageStatusSchema,
  UpdatePageInputSchema,
} from '@claudeshop/contracts/page';
import {
  SystemClock,
  createPage,
  deletePage,
  updatePage,
  type PageRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface PageRoutesDeps {
  repo: PageRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerPageRoutes(
  app: FastifyInstance,
  deps: PageRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  const PageResponseSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    slug: z.string(),
    status: PageStatusSchema,
    title: z.record(z.string()),
    body: z.record(z.string()),
    seo: z
      .object({
        title: z.record(z.string()).optional(),
        description: z.record(z.string()).optional(),
      })
      .nullable(),
    publishedAt: z.string().nullable(),
    authorId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });

  // --- Public: GET /v1/pages/:slug (PUBLISHED only) ------------------------
  zApp.get(
    '/v1/pages/:slug',
    {
      schema: {
        params: z.object({ slug: z.string().min(1) }),
        response: { 200: z.object({ data: PageResponseSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = await deps.repo.findBySlug(tenantId, request.params.slug);
      if (!page || page.status !== 'PUBLISHED') {
        throw new NotFoundError(`Page "${request.params.slug}" not found`);
      }
      return { data: page };
    },
  );

  // --- Admin: GET /v1/admin/pages -----------------------------------------
  zApp.get(
    '/v1/admin/pages',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: PageStatusSchema.optional(),
        }),
        response: {
          200: z.object({
            data: z.array(PageResponseSchema),
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
      const limit = request.query.limit ?? 20;
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        ...(request.query.status ? { status: request.query.status } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  // --- Admin: GET /v1/admin/pages/:id -------------------------------------
  zApp.get(
    '/v1/admin/pages/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: PageResponseSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = await deps.repo.findById(tenantId, request.params.id);
      if (!page) {
        throw new NotFoundError(`Page ${request.params.id} not found`);
      }
      return { data: page };
    },
  );

  // --- Admin: POST /v1/admin/pages ----------------------------------------
  zApp.post(
    '/v1/admin/pages',
    {
      schema: {
        body: CreatePageInputSchema,
        response: { 201: z.object({ data: PageResponseSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = await createPage(request.body, { tenantId, repo: deps.repo, clock });
      return reply.status(201).send({ data: page });
    },
  );

  // --- Admin: PATCH /v1/admin/pages/:id -----------------------------------
  zApp.patch(
    '/v1/admin/pages/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdatePageInputSchema,
        response: { 200: z.object({ data: PageResponseSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = await updatePage(request.params.id, request.body, {
        tenantId,
        repo: deps.repo,
        clock,
      });
      return { data: page };
    },
  );

  // --- Admin: DELETE /v1/admin/pages/:id ----------------------------------
  zApp.delete(
    '/v1/admin/pages/:id',
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
      await deletePage(request.params.id, { tenantId, repo: deps.repo });
      return { data: { deleted: true } };
    },
  );
}
