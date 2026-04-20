import type {
  ChatInput,
  ChatProvider,
  ChatResult,
  ChatToolInvocation,
} from '../ports/chat-provider.js';

/**
 * Deterministic stub ChatProvider for tests and dev-without-API-key.
 *
 * Strategy:
 *  - Parses the most recent user message for simple intent keywords and
 *    invokes at most one matching tool (e.g. "search …" → search_products).
 *  - If no tool matches, replies with a canned help message listing the
 *    available tools.
 *  - Never blocks on network — useful for TDD and offline dev.
 */
export class StubChatProvider implements ChatProvider {
  readonly name = 'stub-chat';

  async chat(input: ChatInput): Promise<ChatResult> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    const match = pickIntent(text, input.tools.map((t) => t.name));
    const invocations: ChatToolInvocation[] = [];

    if (match) {
      try {
        const output = await input.invokeTool(match.name, match.args);
        invocations.push({
          name: match.name,
          input: match.args,
          output: typeof output === 'string' ? output : JSON.stringify(output),
          error: false,
        });
      } catch (err) {
        invocations.push({
          name: match.name,
          input: match.args,
          output: err instanceof Error ? err.message : String(err),
          error: true,
        });
      }
    }

    const assistantText = buildAssistantText(text, input.tools, invocations);

    return {
      text: assistantText,
      toolInvocations: invocations,
      model: 'stub-chat',
      usage: {
        inputTokens: Math.ceil(text.length / 4),
        outputTokens: Math.ceil(assistantText.length / 4),
      },
      truncated: false,
    };
  }
}

interface Intent {
  name: string;
  args: Record<string, unknown>;
}

function pickIntent(text: string, availableTools: string[]): Intent | null {
  const t = text.trim();
  const lower = t.toLowerCase();
  const has = (name: string) => availableTools.includes(name);

  // "search <query>" → search_products
  if (has('search_products')) {
    const m = lower.match(/search(?:\s+for)?\s+(.+)/);
    if (m && m[1]) {
      return { name: 'search_products', args: { query: m[1].trim(), limit: 5 } };
    }
  }

  // "list products" / "show products" → list_products
  if (has('list_products') && /(list|show|all)\s+products?/.test(lower)) {
    return { name: 'list_products', args: { limit: 20 } };
  }

  // "list orders" → list_orders
  if (has('list_orders') && /(list|show|all)\s+orders?/.test(lower)) {
    return { name: 'list_orders', args: { limit: 20 } };
  }

  // "list modules" / "show modules" → list_modules
  if (has('list_modules') && /(list|show)\s+modules?/.test(lower)) {
    return { name: 'list_modules', args: {} };
  }

  return null;
}

function buildAssistantText(
  userText: string,
  tools: { name: string; description: string }[],
  invocations: ChatToolInvocation[],
): string {
  if (invocations.length > 0) {
    const inv = invocations[0]!;
    if (inv.error) {
      return `I tried \`${inv.name}\` but it failed: ${inv.output}`;
    }
    return `I called \`${inv.name}\` and got:\n\n${inv.output}`;
  }

  const userTrimmed = userText.trim();
  const opener = userTrimmed.length > 0
    ? `Stub copilot — no ANTHROPIC_API_KEY configured. I read your message ("${userTrimmed.slice(0, 80)}") but can only match simple patterns.`
    : 'Stub copilot — no ANTHROPIC_API_KEY configured.';

  const toolList = tools.length > 0
    ? `\n\nAvailable tools:\n${tools.map((t) => `- \`${t.name}\` — ${t.description}`).join('\n')}`
    : '';
  const hints = tools.length > 0
    ? '\n\nTry: "search cotton tee", "list products", "list orders", "list modules".'
    : '';
  return `${opener}${toolList}${hints}`;
}
