/**
 * Search repository port — abstracts the vector-store backend used for
 * semantic product search. Phase 4.2 ships a Postgres/pgvector adapter;
 * Phase 4.3+ may add a Meilisearch hybrid or a dedicated vector DB adapter.
 */

export interface UpsertProductEmbeddingInput {
  productId: string;
  model: string;
  dimensions: number;
  /** Vector length MUST equal `dimensions`. */
  vector: number[];
  /** Raw text that was embedded — useful for audit + re-embedding decisions. */
  searchText: string;
}

export interface ProductSearchHit {
  productId: string;
  /**
   * Cosine similarity in [-1, 1]. Higher is better. The adapter computes
   * this from the native distance returned by the vector DB.
   */
  similarity: number;
}

export interface SearchRepository {
  /** Create-or-replace the embedding row for one product in the given tenant. */
  upsertProductEmbedding(
    tenantId: string,
    input: UpsertProductEmbeddingInput,
  ): Promise<void>;

  /** Delete the embedding row for one product (noop if absent). */
  deleteProductEmbedding(tenantId: string, productId: string): Promise<void>;

  /**
   * Return the top-K products most similar to the query vector for this tenant.
   * Vector length MUST equal the dimensions of the previously stored embeddings.
   */
  searchProductsByVector(
    tenantId: string,
    vector: number[],
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]>;

  /**
   * Return products similar to `productId` using the stored embedding (no
   * re-embedding — fast). Excludes the source product from the result set.
   *
   * Returns an empty array if the source product has no embedding yet;
   * callers decide whether to fall back to a different strategy.
   */
  findSimilarToProduct(
    tenantId: string,
    productId: string,
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]>;
}
