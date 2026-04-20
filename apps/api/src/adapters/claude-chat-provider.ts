import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  ChatInput,
  ChatMessage,
  ChatProvider,
  ChatResult,
  ChatToolInvocation,
  ToolDefinition,
} from '@claudeshop/core';

export interface ClaudeChatProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_MAX_ITERATIONS = 6;

/**
 * Anthropic-backed ChatProvider that drives the tool-use loop until the
 * assistant issues a final text response (`stop_reason: 'end_turn'`) or the
 * iteration budget is exhausted.
 *
 * Implementation notes:
 * - The system prompt is cached ephemerally so repeated copilot turns reuse
 *   the prompt cache within the 5-minute TTL.
 * - Each tool's Zod schema is converted to JSON Schema on the fly; the
 *   Anthropic Messages API accepts JSON Schema directly in `input_schema`.
 * - Tool errors are returned to the model as `is_error: true` tool_result
 *   blocks so Claude can choose to retry or ask the user to rephrase.
 * - `truncated` is set when the iteration budget is hit so the route can
 *   warn the merchant rather than silently stopping.
 */
export class ClaudeChatProvider implements ChatProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ClaudeChatProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const maxIterations = input.maxToolIterations ?? DEFAULT_MAX_ITERATIONS;
    const tools = input.tools.map(toAnthropicTool);

    const conversation: Anthropic.MessageParam[] = input.messages.map(toAnthropicMessage);
    const toolInvocations: ChatToolInvocation[] = [];

    let aggregatedInputTokens = 0;
    let aggregatedOutputTokens = 0;
    let aggregatedCachedInputTokens = 0;
    let lastModel = this.model;
    let finalText = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [
          {
            type: 'text',
            text: input.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        ...(tools.length > 0 ? { tools } : {}),
        messages: conversation,
      });

      lastModel = response.model;
      aggregatedInputTokens += response.usage.input_tokens;
      aggregatedOutputTokens += response.usage.output_tokens;
      if (response.usage.cache_read_input_tokens) {
        aggregatedCachedInputTokens += response.usage.cache_read_input_tokens;
      }

      const textParts = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text);
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        finalText = textParts.join('\n').trim();
        return {
          text: finalText,
          toolInvocations,
          model: lastModel,
          usage: usageFrom(
            aggregatedInputTokens,
            aggregatedOutputTokens,
            aggregatedCachedInputTokens,
          ),
          truncated: false,
        };
      }

      // Echo the full assistant message (text + tool_use blocks) back into the
      // conversation so the next turn has the correct history.
      conversation.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        try {
          const output = await input.invokeTool(block.name, block.input);
          const serialised = typeof output === 'string' ? output : JSON.stringify(output);
          toolInvocations.push({
            name: block.name,
            input: block.input,
            output: serialised,
            error: false,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: serialised,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toolInvocations.push({
            name: block.name,
            input: block.input,
            output: message,
            error: true,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: message,
            is_error: true,
          });
        }
      }

      conversation.push({ role: 'user', content: toolResults });

      // If the assistant also emitted some text alongside the tool calls,
      // keep it as partial output so we don't lose it on truncation.
      if (textParts.length > 0) {
        finalText = textParts.join('\n').trim();
      }
    }

    return {
      text:
        finalText ||
        'Tool iteration budget exhausted. I gathered some information but could not converge on a final answer — please rephrase or narrow the request.',
      toolInvocations,
      model: lastModel,
      usage: usageFrom(
        aggregatedInputTokens,
        aggregatedOutputTokens,
        aggregatedCachedInputTokens,
      ),
      truncated: true,
    };
  }
}

function toAnthropicMessage(msg: ChatMessage): Anthropic.MessageParam {
  if (msg.role === 'system') {
    // Shouldn't happen (we pass system separately), but be tolerant.
    return { role: 'user', content: msg.content };
  }
  return { role: msg.role, content: msg.content };
}

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  const jsonSchema = zodToJsonSchema(tool.inputSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  // Anthropic expects `input_schema` to be a JSON Schema object of type
  // "object". If the tool's schema is not an object, wrap it defensively.
  const schema =
    jsonSchema.type === 'object'
      ? (jsonSchema as Anthropic.Tool.InputSchema)
      : ({ type: 'object', properties: {}, additionalProperties: false } as Anthropic.Tool.InputSchema);

  return {
    name: tool.name,
    description: tool.description,
    input_schema: schema,
  };
}

function usageFrom(input: number, output: number, cached: number): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
} {
  return {
    inputTokens: input,
    outputTokens: output,
    ...(cached > 0 ? { cachedInputTokens: cached } : {}),
  };
}

