/**
 * Embedding provider port — abstracts the text → vector backend (Voyage AI,
 * OpenAI, Cohere, local model). Separate from AIProvider because embedding
 * calls have a different cost / rate-limit profile and typically use a
 * different SDK.
 *
 * Phase 4.2 uses embeddings for semantic product search in pgvector; Phase
 * 4.3+ reuses them for recommendations and RAG.
 */

export interface EmbedOneInput {
  text: string;
  /**
   * Hint to the provider about how the text will be used. `document` is for
   * corpus content indexed into the DB; `query` is for the search query at
   * lookup time. Voyage AI and others produce slightly different vectors
   * depending on this hint.
   */
  inputType?: 'document' | 'query';
}

export interface EmbedManyInput {
  texts: string[];
  inputType?: 'document' | 'query';
}

export interface EmbeddingResult {
  /** Raw embedding vector. Length MUST equal `dimensions`. */
  vector: number[];
  /** Model identifier that produced the vector (e.g., "voyage-3-large"). */
  model: string;
  /** Vector dimension. All vectors from one provider instance share the same dim. */
  dimensions: number;
  /** Input tokens consumed by the provider. */
  inputTokens: number;
}

export interface BatchEmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
  inputTokens: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  /** Fixed output dimension for this provider instance. */
  readonly dimensions: number;

  embedOne(input: EmbedOneInput): Promise<EmbeddingResult>;
  embedMany(input: EmbedManyInput): Promise<BatchEmbeddingResult>;
}
