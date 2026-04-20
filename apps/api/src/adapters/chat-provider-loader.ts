import { StubChatProvider, type ChatProvider } from '@claudeshop/core';
import { ClaudeChatProvider } from './claude-chat-provider';

export interface ChatProviderEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
}

/**
 * Pick the copilot ChatProvider at boot.
 *
 * - When `ANTHROPIC_API_KEY` is set → ClaudeChatProvider (real tool-use loop).
 * - Otherwise → StubChatProvider (pattern-matching, no network).
 *
 * Phase 4.3b adds tenant-owned provider overrides (a merchant can bring their
 * own key) via the ModuleRegistry pattern already used for payments.
 */
export function resolveChatProvider(env: ChatProviderEnv): ChatProvider {
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.length === 0) {
    return new StubChatProvider();
  }
  return new ClaudeChatProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
  });
}
