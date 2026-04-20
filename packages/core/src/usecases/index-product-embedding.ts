import { z } from 'zod';
import type { Product } from '@claudeshop/contracts/product';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type { EmbeddingProvider } from '../ports/embedding-provider';
import type { SearchRepository } from '../ports/search-repository';

export const IndexProductEmbeddingInputSchema = z.object({
  productId: z.string().min(1),
});

export type IndexProductEmbeddingInput = z.infer<typeof IndexProductEmbeddingInputSchema>;

export interface IndexProductEmbeddingDeps {
  tenantId: string;
  productRepo: ProductRepository;
  searchRepo: SearchRepository;
  embedder: EmbeddingProvider;
}

export interface IndexProductEmbeddingResult {
  productId: string;
  model: string;
  dimensions: number;
  searchText: string;
  inputTokens: number;
}

const MAX_SEARCH_TEXT_CHARS = 4_000;

/**
 * Build the searchable text for a product and persist its embedding.
 *
 * Contract:
 * - Product must exist in the tenant; NotFoundError otherwise.
 * - Search text concatenates name / tagline / description in all available
 *   locales + the union of variant option values. This gives the embedder
 *   concrete product dimensions alongside merchant copy.
 * - The embedder is called with `inputType: 'document'` so the vector lands
 *   in document-space rather than query-space.
 */
export async function indexProductEmbedding(
  input: IndexProductEmbeddingInput,
  deps: IndexProductEmbeddingDeps,
): Promise<IndexProductEmbeddingResult> {
  const parsed = IndexProductEmbeddingInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid indexProductEmbedding input', {
      details: parsed.error.issues,
    });
  }

  const product = await deps.productRepo.findById(deps.tenantId, parsed.data.productId);
  if (!product) {
    throw new NotFoundError(`Product ${parsed.data.productId} not found`, {
      details: { productId: parsed.data.productId, tenantId: deps.tenantId },
    });
  }

  const searchText = buildSearchText(product);
  const { vector, model, dimensions, inputTokens } = await deps.embedder.embedOne({
    text: searchText,
    inputType: 'document',
  });

  await deps.searchRepo.upsertProductEmbedding(deps.tenantId, {
    productId: product.id,
    model,
    dimensions,
    vector,
    searchText,
  });

  return { productId: product.id, model, dimensions, searchText, inputTokens };
}

function buildSearchText(product: Product): string {
  const lines: string[] = [];

  for (const [locale, value] of Object.entries(product.name)) {
    if (typeof value === 'string' && value.length > 0) {
      lines.push(`[${locale}] ${value}`);
    }
  }

  if (product.description) {
    for (const [locale, value] of Object.entries(product.description)) {
      if (typeof value === 'string' && value.length > 0) {
        lines.push(`[${locale} desc] ${value}`);
      }
    }
  }

  const attributeSet = new Set<string>();
  for (const variant of product.variants) {
    for (const [k, v] of Object.entries(variant.options)) {
      attributeSet.add(`${k}: ${v}`);
    }
  }
  if (attributeSet.size > 0) {
    lines.push(`attributes: ${[...attributeSet].join(', ')}`);
  }

  lines.push(`type: ${product.type}`);
  lines.push(`status: ${product.status}`);
  lines.push(`slug: ${product.slug}`);

  const joined = lines.join('\n');
  return joined.length <= MAX_SEARCH_TEXT_CHARS
    ? joined
    : joined.slice(0, MAX_SEARCH_TEXT_CHARS);
}
