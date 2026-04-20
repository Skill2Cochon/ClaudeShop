import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AIProvider,
  EmbeddingProvider,
  ProductRepository,
  SearchRepository,
} from '@claudeshop/core';
import { generateProductCopy, indexProductEmbedding } from '@claudeshop/core';
import {
  UpdateProductInputSchema,
  ProductSchema,
} from '@claudeshop/contracts/product';
import { NotFoundError } from '@claudeshop/errors';

export interface AdminProductRoutesDeps {
  productRepo: ProductRepository;
  ai: AIProvider;
  embedder: EmbeddingProvider;
  searchRepo: SearchRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Admin surface for product authoring. Phase 4.1 ships a single endpoint —
 * AI-native copy generation. Phase 4.2 adds semantic search + bulk ops.
 */
export async function registerAdminProductRoutes(
  app: FastifyInstance,
  deps: AdminProductRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const BodySchema = z.object({
    seed: z.string().trim().min(1),
    tone: z
      .enum(['friendly', 'premium', 'technical', 'playful', 'minimal'])
      .optional(),
    audience: z.string().optional(),
    maxWords: z.number().int().positive().max(400).optional(),
    locales: z.array(z.string().min(2).max(10)).optional(),
    brandVoiceSamples: z.array(z.string()).optional(),
  });

  const LocaleCopySchema = z.object({
    locale: z.string(),
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    seo: z.object({ title: z.string(), description: z.string() }),
  });

  const ResponseSchema = z.object({
    data: z.object({
      locales: z.array(LocaleCopySchema),
      model: z.string(),
      usage: z.object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        cachedInputTokens: z.number().optional(),
      }),
    }),
  });

  zApp.post(
    '/v1/admin/products/:id/ai/copy',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: BodySchema,
        response: { 200: ResponseSchema },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const result = await generateProductCopy(
        {
          productId: request.params.id,
          seed: request.body.seed,
          ...(request.body.tone !== undefined ? { tone: request.body.tone } : {}),
          ...(request.body.audience !== undefined ? { audience: request.body.audience } : {}),
          ...(request.body.maxWords !== undefined ? { maxWords: request.body.maxWords } : {}),
          ...(request.body.locales !== undefined ? { locales: request.body.locales } : {}),
          ...(request.body.brandVoiceSamples !== undefined
            ? { brandVoiceSamples: request.body.brandVoiceSamples }
            : {}),
        },
        { tenantId, productRepo: deps.productRepo, ai: deps.ai },
      );

      return { data: result };
    },
  );

  // POST /v1/admin/products/:id/reindex — regenerate semantic search embedding
  const ReindexResponseSchema = z.object({
    data: z.object({
      productId: z.string(),
      model: z.string(),
      dimensions: z.number(),
      inputTokens: z.number(),
      searchTextPreview: z.string(),
    }),
  });

  zApp.post(
    '/v1/admin/products/:id/reindex',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: ReindexResponseSchema },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const result = await indexProductEmbedding(
        { productId: request.params.id },
        {
          tenantId,
          productRepo: deps.productRepo,
          searchRepo: deps.searchRepo,
          embedder: deps.embedder,
        },
      );

      return {
        data: {
          productId: result.productId,
          model: result.model,
          dimensions: result.dimensions,
          inputTokens: result.inputTokens,
          searchTextPreview: result.searchText.slice(0, 240),
        },
      };
    },
  );

  // --- PATCH /v1/admin/products/:id — update a product ---------------------
  //
  // Accepts any subset of CreateProductInput (minus variants which are
  // managed separately; Phase 30 layers variant + pricing edits). Returns
  // the updated product. Unknown ids throw NotFoundError which the error
  // handler converts into a 404 envelope.
  zApp.patch(
    '/v1/admin/products/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateProductInputSchema.omit({ variants: true }),
        response: { 200: z.object({ data: ProductSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const product = await deps.productRepo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: product };
    },
  );

  // --- POST /v1/admin/products/:id/archive — archive a product -------------
  zApp.post(
    '/v1/admin/products/:id/archive',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: z.object({ archived: z.boolean() }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      // archive() throws NotFoundError when absent — we let the error
      // handler translate; keeping this route intentionally thin.
      const existing = await deps.productRepo.findById(tenantId, request.params.id);
      if (!existing) {
        throw new NotFoundError(`Product ${request.params.id} not found`, {
          details: { productId: request.params.id },
        });
      }
      await deps.productRepo.archive(tenantId, request.params.id);
      return { data: { archived: true } };
    },
  );
}
