import { VoyageAIClient } from 'voyageai';
import type {
  BatchEmbeddingResult,
  EmbedManyInput,
  EmbedOneInput,
  EmbeddingProvider,
  EmbeddingResult,
} from '@claudeshop/core';

export interface VoyageEmbeddingProviderConfig {
  apiKey: string;
  model: string;
  dimensions: number;
}

/**
 * Voyage AI-backed embedding provider.
 *
 * Voyage is Anthropic's recommended embedding partner. `voyage-3-large` is the
 * current quality champion at 1024 dims; `voyage-3-lite` is the speed/cost
 * alternative at 512.
 *
 * Notes:
 * - Voyage exposes `inputType` hints ("document" | "query") that asymmetrically
 *   tune the embedding space — we pass through our port's hint unchanged.
 * - The `dimensions` value MUST match the model's output. We surface it as a
 *   readonly property so callers can allocate the right pgvector column.
 */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'voyage';
  readonly dimensions: number;
  private readonly client: VoyageAIClient;
  private readonly model: string;

  constructor(config: VoyageEmbeddingProviderConfig) {
    this.client = new VoyageAIClient({ apiKey: config.apiKey });
    this.model = config.model;
    this.dimensions = config.dimensions;
  }

  async embedOne(input: EmbedOneInput): Promise<EmbeddingResult> {
    const response = await this.client.embed({
      input: input.text,
      model: this.model,
      ...(input.inputType ? { inputType: input.inputType } : {}),
    });

    const vector = response.data?.[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new Error('Voyage returned no embedding for input');
    }
    assertDimensions(vector, this.dimensions);

    return {
      vector,
      model: response.model ?? this.model,
      dimensions: this.dimensions,
      inputTokens: response.usage?.totalTokens ?? 0,
    };
  }

  async embedMany(input: EmbedManyInput): Promise<BatchEmbeddingResult> {
    if (input.texts.length === 0) {
      return {
        vectors: [],
        model: this.model,
        dimensions: this.dimensions,
        inputTokens: 0,
      };
    }

    const response = await this.client.embed({
      input: input.texts,
      model: this.model,
      ...(input.inputType ? { inputType: input.inputType } : {}),
    });

    const vectors = (response.data ?? [])
      .map((d) => d.embedding)
      .filter((v): v is number[] => Array.isArray(v) && v.length > 0);

    if (vectors.length !== input.texts.length) {
      throw new Error(
        `Voyage returned ${vectors.length} vectors for ${input.texts.length} inputs`,
      );
    }
    for (const v of vectors) assertDimensions(v, this.dimensions);

    return {
      vectors,
      model: response.model ?? this.model,
      dimensions: this.dimensions,
      inputTokens: response.usage?.totalTokens ?? 0,
    };
  }
}

function assertDimensions(vector: number[], expected: number): void {
  if (vector.length !== expected) {
    throw new Error(
      `Voyage returned vector of dim ${vector.length}; expected ${expected}. ` +
        'Check the configured dimensions match the model output.',
    );
  }
}
