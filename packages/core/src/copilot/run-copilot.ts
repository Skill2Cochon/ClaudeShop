import { z } from 'zod';
import { ValidationError } from '@claudeshop/errors';
import type {
  ChatMessage,
  ChatProvider,
  ChatResult,
} from '../ports/chat-provider';
import type { CopilotToolRegistry } from './tool-registry';

export const RunCopilotInputSchema = z.object({
  message: z.string().trim().min(1, 'message must not be empty'),
  /**
   * Prior turns — most recent last. The orchestrator is stateless; the client
   * is responsible for persistence.
   */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(50)
    .optional(),
  /** Optional extra system-prompt context the caller wants to inject. */
  contextHint: z.string().optional(),
  /**
   * When true, mutating tools (`risk: 'mutating'`) are exposed to the model.
   * When false (default), the registry is filtered to read-only tools so the
   * model cannot accidentally write. The admin UI flips this per session
   * after the merchant explicitly unlocks write access.
   */
  allowMutations: z.boolean().optional(),
});

export type RunCopilotInput = z.infer<typeof RunCopilotInputSchema>;

export interface RunCopilotDeps {
  tenantId: string;
  chatProvider: ChatProvider;
  tools: CopilotToolRegistry;
  /** Optional override for the system prompt. Defaults to DEFAULT_SYSTEM_PROMPT. */
  systemPrompt?: string;
  maxToolIterations?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are the ClaudeShop Copilot — the merchant-facing brain of a Claude-native e-commerce platform.

You operate inside the admin app. Your job:
- Answer questions about the merchant's catalog, orders, and installed modules using the tools available.
- Prefer semantic search (search_products) for fuzzy / natural-language queries; use list_products for "show me all" style.
- Quote concrete numbers (prices, counts, similarity scores) when you have them.
- Be direct and concise. No marketing fluff.
- If you can't answer with the tools available, say so clearly — don't invent data.

Safety rules:
- You can call any number of read tools in a single turn if useful.
- You must never claim a mutation happened; in Phase 4.3 MVP, mutations are not wired yet.
- If asked to change something (update a product, refund an order, install a module), explain what tool would be needed and flag that confirm-to-execute is not yet available.`;

/**
 * Orchestrates one "turn" of the copilot: validates input, assembles the
 * system prompt + tool definitions, delegates the tool-use loop to the
 * ChatProvider, and returns the structured result.
 */
export async function runCopilot(
  input: RunCopilotInput,
  deps: RunCopilotDeps,
): Promise<ChatResult> {
  const parsed = RunCopilotInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid runCopilot input', {
      details: parsed.error.issues,
    });
  }

  const messages: ChatMessage[] = [
    ...(parsed.data.history ?? []),
    { role: 'user', content: parsed.data.message },
  ];

  const allowMutations = parsed.data.allowMutations ?? false;
  const activeRegistry = allowMutations ? deps.tools : deps.tools.readOnly();

  const writeStatusLine = allowMutations
    ? 'Write access is UNLOCKED for this session. Mutating tools run immediately; be sure the user has asked for the change before calling them. Always summarise what you did.'
    : 'Write access is LOCKED for this session. Only read-only tools are available. If the user asks you to change something, explain what would be needed and ask them to unlock writes from the Copilot UI.';

  const systemPrompt = [
    deps.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    `Current tenant id: ${deps.tenantId}.`,
    writeStatusLine,
    parsed.data.contextHint ? `Context hint: ${parsed.data.contextHint}` : '',
  ]
    .filter((l) => l.trim().length > 0)
    .join('\n\n');

  return deps.chatProvider.chat({
    system: systemPrompt,
    messages,
    tools: activeRegistry.definitions(),
    invokeTool: (name, rawInput) => activeRegistry.invoke(name, rawInput),
    ...(deps.maxToolIterations !== undefined
      ? { maxToolIterations: deps.maxToolIterations }
      : {}),
  });
}
