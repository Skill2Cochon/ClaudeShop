import type {
  ProductSearchHit,
  SearchRepository,
  UpsertProductEmbeddingInput,
} from '../ports/search-repository.js';

interface StoredEmbedding {
  tenantId: string;
  productId: string;
  model: string;
  dimensions: number;
  searchText: string;
  vector: number[];
}

/**
 * In-memory SearchRepository for unit tests. Computes cosine similarity in JS
 * — not suitable for production but behaviourally equivalent to pgvector's
 * `vector_cosine_ops` for small inputs.
 */
export class InMemorySearchRepository implements SearchRepository {
  private readonly rows = new Map<string, StoredEmbedding>();

  async upsertProductEmbedding(
    tenantId: string,
    input: UpsertProductEmbeddingInput,
  ): Promise<void> {
    if (input.vector.length !== input.dimensions) {
      throw new Error(
        `Vector length ${input.vector.length} does not match dimensions ${input.dimensions}`,
      );
    }
    this.rows.set(input.productId, {
      tenantId,
      productId: input.productId,
      model: input.model,
      dimensions: input.dimensions,
      searchText: input.searchText,
      vector: input.vector.slice(),
    });
  }

  async deleteProductEmbedding(_tenantId: string, productId: string): Promise<void> {
    this.rows.delete(productId);
  }

  async searchProductsByVector(
    tenantId: string,
    vector: number[],
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]> {
    const minSim = opts.minSimilarity ?? -1;
    const hits: ProductSearchHit[] = [];
    for (const row of this.rows.values()) {
      if (row.tenantId !== tenantId) continue;
      if (row.vector.length !== vector.length) continue;
      const similarity = cosineSimilarity(vector, row.vector);
      if (similarity < minSim) continue;
      hits.push({ productId: row.productId, similarity });
    }
    hits.sort((a, b) => b.similarity - a.similarity);
    return hits.slice(0, opts.limit);
  }

  async findSimilarToProduct(
    tenantId: string,
    productId: string,
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]> {
    const source = this.rows.get(productId);
    if (!source || source.tenantId !== tenantId) return [];
    const hits = await this.searchProductsByVector(tenantId, source.vector, {
      limit: opts.limit + 1,
      ...(opts.minSimilarity !== undefined ? { minSimilarity: opts.minSimilarity } : {}),
    });
    return hits.filter((h) => h.productId !== productId).slice(0, opts.limit);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
