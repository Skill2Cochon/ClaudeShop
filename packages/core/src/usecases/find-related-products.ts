import { z } from 'zod';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type {
  ProductSearchHit,
  SearchRepository,
} from '../ports/search-repository';

export const FindRelatedProductsInputSchema = z.object({
  productId: z.string().min(1, 'productId must not be empty'),
  limit: z.number().int().positive().optional(),
  minSimilarity: z.number().min(-1).max(1).optional(),
});

export type FindRelatedProductsInput = z.infer<typeof FindRelatedProductsInputSchema>;

export interface FindRelatedProductsDeps {
  tenantId: string;
  productRepo: ProductRepository;
  searchRepo: SearchRepository;
}

export interface FindRelatedProductsResult {
  sourceProductId: string;
  hits: ProductSearchHit[];
}

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 20;

/**
 * Find products similar to a given product using its stored embedding.
 *
 * Unlike searchProducts (Phase 4.2), this use-case does NOT call the
 * embedding provider — it reuses the vector persisted when the product
 * was last reindexed, so the storefront's "related products" rail costs
 * only a single pgvector query per PDP render.
 *
 * Contract:
 * - Product must exist in the tenant; NotFoundError otherwise.
 * - Source product is excluded from the result set by the repository.
 * - Limit defaults to 4 (a typical PDP rail), capped at 20.
 * - If the product has no embedding yet, returns an empty result rather
 *   than throwing; callers may fall back to a non-AI recommendation.
 */
export async function findRelatedProducts(
  input: FindRelatedProductsInput,
  deps: FindRelatedProductsDeps,
): Promise<FindRelatedProductsResult> {
  const parsed = FindRelatedProductsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid findRelatedProducts input', {
      details: parsed.error.issues,
    });
  }

  const product = await deps.productRepo.findById(deps.tenantId, parsed.data.productId);
  if (!product) {
    throw new NotFoundError(`Product ${parsed.data.productId} not found`, {
      details: { productId: parsed.data.productId, tenantId: deps.tenantId },
    });
  }

  const limit = Math.min(parsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const hits = await deps.searchRepo.findSimilarToProduct(
    deps.tenantId,
    parsed.data.productId,
    {
      limit,
      ...(parsed.data.minSimilarity !== undefined
        ? { minSimilarity: parsed.data.minSimilarity }
        : {}),
    },
  );

  return { sourceProductId: parsed.data.productId, hits };
}
