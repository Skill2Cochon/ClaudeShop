import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  ProductRepository,
  WishlistRepository,
} from '@claudeshop/core';

export interface WishlistRoutesDeps {
  wishlistRepo: WishlistRepository;
  productRepo: ProductRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Storefront wishlist. Called from the customer-authenticated server
 * actions, so the caller is responsible for passing the customerId
 * explicitly (same convention orders.ts uses). The API is happy serving
 * reads + toggles — it doesn't know who owns the iron-session cookie.
 *
 * - GET /v1/wishlist?customerId=... — list entries, newest first
 * - POST /v1/wishlist/toggle { customerId, productId } — toggle one
 */
export async function registerWishlistRoutes(
  app: FastifyInstance,
  deps: WishlistRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const EntrySchema = z.object({
    productId: z.string(),
    createdAt: z.string(),
    /** Hydrated product summary — null when the product was archived/deleted. */
    product: z
      .object({
        id: z.string(),
        slug: z.string(),
        name: z.record(z.string()),
        status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
      })
      .nullable(),
  });

  zApp.get(
    '/v1/wishlist',
    {
      schema: {
        querystring: z.object({ customerId: z.string().min(1) }),
        response: { 200: z.object({ data: z.array(EntrySchema) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const entries = await deps.wishlistRepo.list(
        tenantId,
        request.query.customerId,
      );

      // Hydrate each entry with its product summary. Serial findById is
      // fine here — wishlists are short (a few dozen max) and orders of
      // magnitude smaller than catalog lists. Phase 27.1 can add a
      // findMany(ids) batch if profiling shows latency.
      const hydrated = await Promise.all(
        entries.map(async (entry) => {
          const product = await deps.productRepo.findById(tenantId, entry.productId);
          return {
            productId: entry.productId,
            createdAt: entry.createdAt,
            product: product
              ? {
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  status: product.status,
                }
              : null,
          };
        }),
      );

      return { data: hydrated };
    },
  );

  zApp.post(
    '/v1/wishlist/toggle',
    {
      schema: {
        body: z.object({
          customerId: z.string().min(1),
          productId: z.string().min(1),
        }),
        response: {
          200: z.object({
            data: z.object({ favourited: z.boolean() }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const result = await deps.wishlistRepo.toggle(
        tenantId,
        request.body.customerId,
        request.body.productId,
      );
      return { data: result };
    },
  );
}
