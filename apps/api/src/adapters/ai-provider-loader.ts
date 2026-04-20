import { StubAIProvider, type AIProvider } from '@claudeshop/core';
import { ClaudeAIProvider } from './claude-ai-provider.js';

export interface AIProviderEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
}

/**
 * Resolve the platform AI provider at boot.
 *
 * - When `ANTHROPIC_API_KEY` is set → ClaudeAIProvider.
 * - Otherwise → StubAIProvider (deterministic, dev-safe).
 *
 * Phase 4.2+ layers tenant-installed AI modules on top of this fallback
 * the same way ModuleRegistry does for PaymentProvider.
 */
export function resolveAIProvider(env: AIProviderEnv): AIProvider {
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.length === 0) {
    return new StubAIProvider();
  }
  return new ClaudeAIProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
  });
}
