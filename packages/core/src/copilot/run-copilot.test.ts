import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '@claudeshop/errors';
import type {
  ChatInput,
  ChatProvider,
  ChatResult,
} from '../ports/chat-provider';
import { StubChatProvider } from '../adapters/stub-chat-provider';
import { CopilotToolRegistry } from './tool-registry';
import { runCopilot } from './run-copilot';

/** Records the last ChatInput so tests can assert on system + tools + history. */
class RecordingChatProvider implements ChatProvider {
  readonly name = 'recording';
  lastInput?: ChatInput;

  async chat(input: ChatInput): Promise<ChatResult> {
    this.lastInput = input;
    // Call the first tool if any, just to exercise the invoker wiring.
    const invocations: ChatResult['toolInvocations'] = [];
    if (input.tools.length > 0) {
      const first = input.tools[0]!;
      try {
        const output = await input.invokeTool(first.name, { query: 'tee', limit: 3 });
        invocations.push({
          name: first.name,
          input: { query: 'tee', limit: 3 },
          output: typeof output === 'string' ? output : JSON.stringify(output),
          error: false,
        });
      } catch (err) {
        invocations.push({
          name: first.name,
          input: { query: 'tee', limit: 3 },
          output: err instanceof Error ? err.message : String(err),
          error: true,
        });
      }
    }
    return {
      text: 'ok',
      toolInvocations: invocations,
      model: 'recording',
      usage: { inputTokens: 10, outputTokens: 5 },
      truncated: false,
    };
  }
}

function makeRegistry() {
  const registry = new CopilotToolRegistry();
  registry.register({
    name: 'search_products',
    description: 'search',
    risk: 'read',
    inputSchema: z.object({ query: z.string().min(1), limit: z.number().optional() }),
    handler: async ({ query, limit }) => ({ hits: [`${query}:${limit ?? 0}`] }),
  });
  registry.register({
    name: 'list_products',
    description: 'list',
    risk: 'read',
    inputSchema: z.object({ limit: z.number().optional() }),
    handler: async ({ limit }) => ({ items: [], total: 0, limit }),
  });
  return registry;
}

function makeMixedRegistry() {
  const registry = makeRegistry();
  registry.register({
    name: 'reindex_product',
    description: 'reindex',
    risk: 'mutating',
    inputSchema: z.object({ productId: z.string().min(1) }),
    handler: async ({ productId }) => ({ reindexed: productId }),
  });
  return registry;
}

describe('runCopilot', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let registry: CopilotToolRegistry;
  let provider: RecordingChatProvider;

  beforeEach(() => {
    registry = makeRegistry();
    provider = new RecordingChatProvider();
  });

  it('passes user message + history to the chat provider in order', async () => {
    await runCopilot(
      {
        message: 'find me the tees',
        history: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello, what can I help with?' },
        ],
      },
      { tenantId, chatProvider: provider, tools: registry },
    );

    const msgs = provider.lastInput?.messages ?? [];
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toEqual({ role: 'user', content: 'hi' });
    expect(msgs[2]).toEqual({ role: 'user', content: 'find me the tees' });
  });

  it('includes tenant id in the system prompt', async () => {
    await runCopilot(
      { message: 'hi' },
      { tenantId, chatProvider: provider, tools: registry },
    );
    expect(provider.lastInput?.system).toContain(tenantId);
  });

  it('exposes every registered tool to the chat provider', async () => {
    await runCopilot(
      { message: 'hi' },
      { tenantId, chatProvider: provider, tools: registry },
    );
    const names = (provider.lastInput?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual(['list_products', 'search_products']);
  });

  it('invokes tools via the registry and returns their output to the provider', async () => {
    const result = await runCopilot(
      { message: 'anything' },
      { tenantId, chatProvider: provider, tools: registry },
    );
    expect(result.toolInvocations).toHaveLength(1);
    expect(result.toolInvocations[0]?.error).toBe(false);
    expect(result.toolInvocations[0]?.output).toContain('tee:3');
  });

  it('surfaces Zod validation errors on bad tool input to the model as tool errors', async () => {
    // Register a tool that requires a string and call it with the wrong shape.
    const bad = new CopilotToolRegistry();
    bad.register({
      name: 'strict_tool',
      description: 'strict',
      risk: 'read',
      inputSchema: z.object({ userId: z.string().min(5) }),
      handler: async () => 'never reached',
    });
    class CallWithBadInput implements ChatProvider {
      readonly name = 'bad';
      async chat(input: ChatInput): Promise<ChatResult> {
        try {
          const output = await input.invokeTool('strict_tool', { userId: 'x' });
          return {
            text: '',
            toolInvocations: [
              {
                name: 'strict_tool',
                input: { userId: 'x' },
                output: typeof output === 'string' ? output : JSON.stringify(output),
                error: false,
              },
            ],
            model: 'bad',
            usage: { inputTokens: 0, outputTokens: 0 },
            truncated: false,
          };
        } catch (err) {
          return {
            text: 'caught',
            toolInvocations: [
              {
                name: 'strict_tool',
                input: { userId: 'x' },
                output: err instanceof Error ? err.message : String(err),
                error: true,
              },
            ],
            model: 'bad',
            usage: { inputTokens: 0, outputTokens: 0 },
            truncated: false,
          };
        }
      }
    }

    const result = await runCopilot(
      { message: 'anything' },
      { tenantId, chatProvider: new CallWithBadInput(), tools: bad },
    );
    expect(result.toolInvocations[0]?.error).toBe(true);
    expect(result.toolInvocations[0]?.output).toContain('strict_tool');
  });

  it('rejects empty user messages via Zod', async () => {
    await expect(
      runCopilot(
        { message: '   ' },
        { tenantId, chatProvider: provider, tools: registry },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('caps history at 50 turns', async () => {
    const history = Array.from({ length: 51 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}`,
    }));
    await expect(
      runCopilot(
        { message: 'new turn', history },
        { tenantId, chatProvider: provider, tools: registry },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('appends the optional contextHint to the system prompt', async () => {
    await runCopilot(
      { message: 'hi', contextHint: 'Merchant is mid-onboarding — tone: reassuring.' },
      { tenantId, chatProvider: provider, tools: registry },
    );
    expect(provider.lastInput?.system).toContain('mid-onboarding');
  });

  it('filters mutating tools out of the registry by default (allowMutations=false)', async () => {
    const mixed = makeMixedRegistry();
    await runCopilot(
      { message: 'hi' },
      { tenantId, chatProvider: provider, tools: mixed },
    );
    const names = (provider.lastInput?.tools ?? []).map((t) => t.name);
    expect(names).toContain('search_products');
    expect(names).toContain('list_products');
    expect(names).not.toContain('reindex_product');
  });

  it('exposes mutating tools when allowMutations=true', async () => {
    const mixed = makeMixedRegistry();
    await runCopilot(
      { message: 'hi', allowMutations: true },
      { tenantId, chatProvider: provider, tools: mixed },
    );
    const names = (provider.lastInput?.tools ?? []).map((t) => t.name);
    expect(names).toContain('reindex_product');
  });

  it('injects a "write access LOCKED" line when allowMutations=false', async () => {
    await runCopilot(
      { message: 'hi' },
      { tenantId, chatProvider: provider, tools: registry },
    );
    expect(provider.lastInput?.system).toContain('LOCKED');
  });

  it('injects a "write access UNLOCKED" line when allowMutations=true', async () => {
    await runCopilot(
      { message: 'hi', allowMutations: true },
      { tenantId, chatProvider: provider, tools: registry },
    );
    expect(provider.lastInput?.system).toContain('UNLOCKED');
  });
});

describe('StubChatProvider + runCopilot integration', () => {
  const tenantId = 'tnt01h0000000000000000000';

  it('calls search_products when the user says "search <term>"', async () => {
    const registry = makeRegistry();
    const result = await runCopilot(
      { message: 'search cotton tee' },
      { tenantId, chatProvider: new StubChatProvider(), tools: registry },
    );
    expect(result.toolInvocations).toHaveLength(1);
    expect(result.toolInvocations[0]?.name).toBe('search_products');
  });

  it('falls back to help text with no tool call when no intent matches', async () => {
    const registry = makeRegistry();
    const result = await runCopilot(
      { message: 'tell me a joke' },
      { tenantId, chatProvider: new StubChatProvider(), tools: registry },
    );
    expect(result.toolInvocations).toHaveLength(0);
    expect(result.text).toContain('Stub copilot');
  });
});
