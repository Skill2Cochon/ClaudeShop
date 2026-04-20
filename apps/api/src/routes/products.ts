import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateProductInputSchema,
  ProductSchema,
  ProductStatusSchema,
} from '@claudeshop/contracts/product';
import { PaginationQuerySchema, SlugSchema } from '@claudeshop/contracts/common';
import {
  createProduct,
  type ProductRepository,
  type VariantRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';
import { SystemClock } from '@claudeshop/db';
import type { Product } from '@claudeshop/contracts/product';

export interface ProductRoutesDeps {
  repo: ProductRepository;
  /** Phase 15 — used to resolve variant prices when `priceFor` is set. */
  variantRepo?: VariantRepository;
  /** Resolved from request (auth + subdomain). Phase 1 stub uses a header. */
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

async function enrichWithPrices(
  product: Product,
  tenantId: string,
  currency: string,
  variantRepo: VariantRepository,
): Promise<Product> {
  const variants = await Promise.all(
    product.variants.map(async (v) => {
      const amount = await variantRepo.getPriceFor(tenantId, v.id, { currency });
      if (amount === null) return v;
      return { ...v, price: { amount, currency } };
    }),
  );
  return { ...product, variants };
}

export async function registerProductRoutes(
  app: FastifyInstance,
  deps: ProductRoutesDeps,
): Promise<void> {
  const clock = new SystemClock();
  // Re-apply the ZodTypeProvider so schemas flow correctly through this scope.
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  // --- POST /v1/products ---------------------------------------------------
  zApp.post('/v1/products', {
    schema: {
      body: CreateProductInputSchema,
      response: {
        201: z.object({ data: ProductSchema }),
      },
    },
  }, async (request, reply) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const product = await createProduct(request.body, { tenantId, repo: deps.repo, clock });
    return reply.status(201).send({ data: product });
  });

  // --- GET /v1/products ----------------------------------------------------
  const ListQuerySchema = PaginationQuerySchema.extend({
    status: ProductStatusSchema.optional(),
    priceFor: z.string().length(3).optional(),
  });

  zApp.get('/v1/products', {
    schema: {
      querystring: ListQuerySchema,
      response: {
        200: z.object({
          data: z.array(ProductSchema),
          meta: z.object({
            page: z.number().int(),
            limit: z.number().int(),
            total: z.number().int(),
          }),
        }),
      },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const { items, total } = await deps.repo.list(tenantId, {
      page: request.query.page,
      limit: request.query.limit,
      ...(request.query.status ? { status: request.query.status } : {}),
    });
    let data = items;
    if (request.query.priceFor && deps.variantRepo) {
      const currency = request.query.priceFor.toUpperCase();
      data = await Promise.all(
        items.map((p) => enrichWithPrices(p, tenantId, currency, deps.variantRepo!)),
      );
    }
    return {
      data,
      meta: { page: request.query.page, limit: request.query.limit, total },
    };
  });

  // --- GET /v1/products/:slug ---------------------------------------------
  zApp.get('/v1/products/:slug', {
    schema: {
      params: z.object({ slug: SlugSchema }),
      querystring: z.object({ priceFor: z.string().length(3).optional() }),
      response: {
        200: z.object({ data: ProductSchema }),
      },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const product = await deps.repo.findBySlug(tenantId, request.params.slug);
    if (!product) throw new NotFoundError(`Product "${request.params.slug}" not found`);
    if (request.query.priceFor && deps.variantRepo) {
      const enriched = await enrichWithPrices(
        product,
        tenantId,
        request.query.priceFor.toUpperCase(),
        deps.variantRepo,
      );
      return { data: enriched };
    }
    return { data: product };
  });
}
