/**
 * AI provider port — abstracts the LLM backend (Claude, GPT, Gemini, local
 * model). Phase 4.1 starts with product copy generation; Phase 4.2+ adds
 * semantic search, recommendations, admin command routing.
 */

export interface GenerateProductCopyInput {
  /** Freeform short description of the product (1–2 sentences from the merchant). */
  seed: string;
  /**
   * Constraint hints: target tone, audience, max length. Optional — the
   * provider picks sensible defaults.
   */
  tone?: 'friendly' | 'premium' | 'technical' | 'playful' | 'minimal';
  audience?: string;
  maxWords?: number;
  /** Locales to generate copy in. First entry is the primary. */
  locales?: string[];
  /** Brand voice snippets — if present, the model mimics them. */
  brandVoiceSamples?: string[];
  /** Product attributes (size, color, material) to weave in naturally. */
  attributes?: Record<string, string>;
}

export interface LocalizedProductCopy {
  locale: string;
  name: string;
  tagline: string;
  description: string;
  seo: {
    title: string;
    description: string;
  };
}

export interface ProductCopyResult {
  locales: LocalizedProductCopy[];
  /** Which model actually produced the output (e.g. "claude-sonnet-4-7"). */
  model: string;
  /** Token usage for billing + budget tracking. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
}

export interface AIProvider {
  readonly name: string;

  /**
   * Generate localised product copy from a seed description. Implementations
   * SHOULD use prompt caching on the system prompt to keep per-call cost
   * low. They MUST return deterministic fields even when one locale fails —
   * skip the failing locale rather than throwing the whole call.
   */
  generateProductCopy(input: GenerateProductCopyInput): Promise<ProductCopyResult>;
}
