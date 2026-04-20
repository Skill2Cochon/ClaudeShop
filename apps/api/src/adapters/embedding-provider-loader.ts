import { StubEmbeddingProvider, type EmbeddingProvider } from '@claudeshop/core';
import { VoyageEmbeddingProvider } from './voyage-embedding-provider.js';

export interface EmbeddingProviderEnv {
  VOYAGE_API_KEY?: string;
  VOYAGE_MODEL: string;
  VOYAGE_DIMENSIONS: number;
}

/**
 * Boot-time resolver for the platform embedding provider.
 *
 * - When `VOYAGE_API_KEY` is set → VoyageEmbeddingProvider.
 * - Otherwise → StubEmbeddingProvider (deterministic, dev-safe, no API calls).
 *
 * The stub uses the same dimensions as Voyage so pgvector rows stay
 * interchangeable between dev and prod.
 */
export function resolveEmbeddingProvider(env: EmbeddingProviderEnv): EmbeddingProvider {
  if (!env.VOYAGE_API_KEY || env.VOYAGE_API_KEY.length === 0) {
    return new StubEmbeddingProvider(env.VOYAGE_DIMENSIONS);
  }
  return new VoyageEmbeddingProvider({
    apiKey: env.VOYAGE_API_KEY,
    model: env.VOYAGE_MODEL,
    dimensions: env.VOYAGE_DIMENSIONS,
  });
}
