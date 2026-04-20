import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { findRelatedProducts, searchProducts } from '@claudeshop/core';
import type {
  EmbeddingProvider,
  ProductRepository,
  SearchRepository,
} from '@claudeshop/core';

export interface SearchRoutesDeps {
  productRepo: ProductRepository;
  searchRepo: SearchRepository;
  embedder: EmbeddingProvider;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Semantic search — storefront-facing.
 *
 * GET /v1/search/products?q=…&limit=…&minSimilarity=…
 *
 * Returns hydrated product summaries (name, slug, status) so the storefront
 * can render a results page without a second round-trip per hit.
 */
export async function registerSearchRoutes(
  app: FastifyInstance,
  deps: SearchRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const HitSchema = z.object({
    productId: z.string(),
    slug: z.string(),
    name: z.record(z.string()),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    similarity: z.number(),
  });

  const ResponseSchema = z.object({
    data: z.array(HitSchema),
    meta: z.object({
      query: z.string(),
      model: z.string(),
      dimensions: z.number(),
      inputTokens: z.number(),
    }),
  });

  zApp.get(
    '/v1/search/products',
    {
      schema: {
        querystring: z.object({
          q: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          minSimilarity: z.coerce.number().min(-1).max(1).optional(),
        }),
        response: { 200: ResponseSchema },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const result = await searchProducts(
        {
          query: request.query.q,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.minSimilarity !== undefined
            ? { minSimilarity: request.query.minSimilarity }
            : {}),
        },
        { tenantId, searchRepo: deps.searchRepo, embedder: deps.embedder },
      );

      // Hydrate hits with product summaries in one batched query pattern
      // (serial findById here — swap to a bulk repo method in Phase 4.3 if
      // profiling shows latency).
      const hydrated = await Promise.all(
        result.hits.map(async (hit) => {
          const p = await deps.productRepo.findById(tenantId, hit.productId);
          if (!p) return null;
          return {
            productId: hit.productId,
            slug: p.slug,
            name: p.name,
            status: p.status,
            similarity: hit.similarity,
          };
        }),
      );

      return {
        data: hydrated.filter((h): h is NonNullable<typeof h> => h !== null),
        meta: {
          query: request.query.q,
          model: result.model,
          dimensions: result.dimensions,
          inputTokens: result.inputTokens,
        },
      };
    },
  );

  // --- GET /v1/search/related?productId=&limit= ---------------------------
  const RelatedHitSchema = z.object({
    productId: z.string(),
    slug: z.string(),
    name: z.record(z.string()),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    similarity: z.number(),
  });

  const RelatedResponseSchema = z.object({
    data: z.array(RelatedHitSchema),
    meta: z.object({
      sourceProductId: z.string(),
      count: z.number(),
    }),
  });

  zApp.get(
    '/v1/search/related',
    {
      schema: {
        querystring: z.object({
          productId: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          minSimilarity: z.coerce.number().min(-1).max(1).optional(),
        }),
        response: { 200: RelatedResponseSchema },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const result = await findRelatedProducts(
        {
          productId: request.query.productId,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.minSimilarity !== undefined
            ? { minSimilarity: request.query.minSimilarity }
            : {}),
        },
        { tenantId, productRepo: deps.productRepo, searchRepo: deps.searchRepo },
      );

      // Filter to ACTIVE products only — storefront-facing surface.
      const hydrated = await Promise.all(
        result.hits.map(async (hit) => {
          const p = await deps.productRepo.findById(tenantId, hit.productId);
          if (!p || p.status !== 'ACTIVE') return null;
          return {
            productId: hit.productId,
            slug: p.slug,
            name: p.name,
            status: p.status,
            similarity: hit.similarity,
          };
        }),
      );

      const hits = hydrated.filter((h): h is NonNullable<typeof h> => h !== null);
      return {
        data: hits,
        meta: { sourceProductId: result.sourceProductId, count: hits.length },
      };
    },
  );
}
