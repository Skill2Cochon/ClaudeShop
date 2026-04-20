import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CategorySchema } from '@claudeshop/contracts/category';
import { ProductSchema } from '@claudeshop/contracts/product';
import { SlugSchema } from '@claudeshop/contracts/common';
import type { CategoryRepository, VariantRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface CategoryRoutesDeps {
  repo: CategoryRepository;
  variantRepo?: VariantRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerCategoryRoutes(
  app: FastifyInstance,
  deps: CategoryRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  // --- Public: GET /v1/categories ----------------------------------------
  zApp.get(
    '/v1/categories',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          parentId: z.string().optional(),
          rootOnly: z.enum(['true', 'false']).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(CategorySchema),
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
      const parentId =
        request.query.rootOnly === 'true'
          ? null
          : request.query.parentId ?? undefined;
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        isActive: true,
        ...(parentId !== undefined ? { parentId } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  // --- Public: GET /v1/categories/:slug ----------------------------------
  zApp.get(
    '/v1/categories/:slug',
    {
      schema: {
        params: z.object({ slug: SlugSchema }),
        response: { 200: z.object({ data: CategorySchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const cat = await deps.repo.findBySlug(tenantId, request.params.slug);
      if (!cat || !cat.isActive) {
        throw new NotFoundError(`Category "${request.params.slug}" not found`);
      }
      return { data: cat };
    },
  );

  // --- Public: GET /v1/categories/:slug/products -------------------------
  zApp.get(
    '/v1/categories/:slug/products',
    {
      schema: {
        params: z.object({ slug: SlugSchema }),
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          priceFor: z.string().length(3).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(ProductSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              categoryId: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const cat = await deps.repo.findBySlug(tenantId, request.params.slug);
      if (!cat || !cat.isActive) {
        throw new NotFoundError(`Category "${request.params.slug}" not found`);
      }
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 24;
      const { items, total } = await deps.repo.listProducts(tenantId, cat.id, {
        page,
        limit,
      });
      let data = items;
      if (request.query.priceFor && deps.variantRepo) {
        const currency = request.query.priceFor.toUpperCase();
        const variantRepo = deps.variantRepo;
        data = await Promise.all(
          items.map(async (p) => ({
            ...p,
            variants: await Promise.all(
              p.variants.map(async (v) => {
                const amount = await variantRepo.getPriceFor(tenantId, v.id, {
                  currency,
                });
                if (amount === null) return v;
                return { ...v, price: { amount, currency } };
              }),
            ),
          })),
        );
      }
      return {
        data,
        meta: { page, limit, total, categoryId: cat.id },
      };
    },
  );
}
