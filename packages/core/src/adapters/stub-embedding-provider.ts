import { createHash } from 'node:crypto';
import type {
  EmbeddingProvider,
  EmbedOneInput,
  EmbedManyInput,
  EmbeddingResult,
  BatchEmbeddingResult,
} from '../ports/embedding-provider';

/**
 * Deterministic, hash-based embedding provider. Produces fake but stable
 * vectors suitable for unit tests and for local dev when VOYAGE_API_KEY is
 * not set.
 *
 * Not semantically meaningful — two texts with similar words will NOT be
 * close in vector space. For real semantic search, use VoyageEmbeddingProvider.
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'stub';
  readonly dimensions: number;

  constructor(dimensions = 1024) {
    if (dimensions < 8 || dimensions > 4096) {
      throw new Error(`StubEmbeddingProvider: dimensions must be 8..4096, got ${dimensions}`);
    }
    this.dimensions = dimensions;
  }

  async embedOne(input: EmbedOneInput): Promise<EmbeddingResult> {
    return {
      vector: deterministicVector(input.text, this.dimensions),
      model: 'stub-sha256',
      dimensions: this.dimensions,
      inputTokens: tokenEstimate(input.text),
    };
  }

  async embedMany(input: EmbedManyInput): Promise<BatchEmbeddingResult> {
    const vectors = input.texts.map((t) => deterministicVector(t, this.dimensions));
    const inputTokens = input.texts.reduce((acc, t) => acc + tokenEstimate(t), 0);
    return {
      vectors,
      model: 'stub-sha256',
      dimensions: this.dimensions,
      inputTokens,
    };
  }
}

function deterministicVector(text: string, dim: number): number[] {
  // Chain SHA-256 hashes to fill `dim` floats in [-1, 1]. Normalised to unit
  // length so cosine similarity behaves the same way as for real embeddings.
  const out = new Float64Array(dim);
  let filled = 0;
  let counter = 0;
  let seed = text.length === 0 ? 'empty' : text;
  while (filled < dim) {
    const buf = createHash('sha256').update(`${counter}|${seed}`).digest();
    for (let i = 0; i + 2 <= buf.length && filled < dim; i += 2) {
      const raw = buf.readInt16BE(i); // -32768..32767
      out[filled++] = raw / 32768;
    }
    counter++;
    seed = buf.toString('hex');
  }
  return normalise(Array.from(out));
}

function normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

function tokenEstimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
