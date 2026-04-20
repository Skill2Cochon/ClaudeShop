import { z } from 'zod';
import { ValidationError } from '@claudeshop/errors';
import type { EmbeddingProvider } from '../ports/embedding-provider.js';
import type {
  ProductSearchHit,
  SearchRepository,
} from '../ports/search-repository.js';

export const SearchProductsInputSchema = z.object({
  query: z.string().trim().min(1, 'query must not be empty'),
  limit: z.number().int().positive().optional(),
  /** Cosine similarity threshold. Defaults to 0 (keep everything). */
  minSimilarity: z.number().min(-1).max(1).optional(),
});

export type SearchProductsInput = z.infer<typeof SearchProductsInputSchema>;

export interface SearchProductsDeps {
  tenantId: string;
  searchRepo: SearchRepository;
  embedder: EmbeddingProvider;
}

export interface SearchProductsResult {
  hits: ProductSearchHit[];
  model: string;
  dimensions: number;
  inputTokens: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Embed a natural-language query and return products ranked by cosine
 * similarity.
 *
 * Contract:
 * - Input validated via Zod; invalid throws ValidationError.
 * - Limit capped at MAX_LIMIT so a misbehaving caller cannot DoS the DB.
 * - The embedder is called with `inputType: 'query'` so the vector lives in
 *   query-space (Voyage and others asymmetrically tune the two spaces).
 */
export async function searchProducts(
  input: SearchProductsInput,
  deps: SearchProductsDeps,
): Promise<SearchProductsResult> {
  const parsed = SearchProductsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid searchProducts input', {
      details: parsed.error.issues,
    });
  }

  const limit = Math.min(parsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const { vector, model, dimensions, inputTokens } = await deps.embedder.embedOne({
    text: parsed.data.query,
    inputType: 'query',
  });

  const hits = await deps.searchRepo.searchProductsByVector(deps.tenantId, vector, {
    limit,
    ...(parsed.data.minSimilarity !== undefined
      ? { minSimilarity: parsed.data.minSimilarity }
      : {}),
  });

  return { hits, model, dimensions, inputTokens };
}
