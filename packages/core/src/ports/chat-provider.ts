/**
 * Chat provider port — abstracts the LLM chat+tool-use backend.
 *
 * Separate from AIProvider (Phase 4.1) because:
 *   - chat is stateful (message history) while product copy is one-shot,
 *   - tool use is a first-class feature here — the adapter is responsible
 *     for driving the tool-call loop until the model issues a final text
 *     response.
 *
 * The runCopilot use-case wraps this port with a tool registry, so tools
 * are defined once (Zod schema + handler) and both execution + Claude's
 * function-calling contract come from the same source of truth.
 */

import type { z } from 'zod';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ToolDefinition {
  /** Stable machine-readable identifier — lowercase, snake_case, unique. */
  name: string;
  /** One-sentence description the LLM sees — dictates when it calls the tool. */
  description: string;
  /** Zod schema for the tool's input payload. */
  inputSchema: z.ZodTypeAny;
}

export type ToolInvoker = (name: string, input: unknown) => Promise<unknown>;

export interface ChatToolInvocation {
  name: string;
  input: unknown;
  /** Stringified result returned to the model (JSON or plain text). */
  output: string;
  /** True when the tool threw; `output` holds the error message in that case. */
  error: boolean;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ChatResult {
  /** Final text response from the assistant after the tool loop converges. */
  text: string;
  /** Ordered list of every tool the model invoked during the loop. */
  toolInvocations: ChatToolInvocation[];
  /** Model identifier that produced the output. */
  model: string;
  /** Aggregated token usage across the whole loop. */
  usage: ChatUsage;
  /** True if the loop stopped early (budget exhausted, etc.). */
  truncated: boolean;
}

export interface ChatInput {
  /** System instructions — persona, guardrails, tool usage guidance. */
  system: string;
  /** Full conversation history, most recent last. */
  messages: ChatMessage[];
  /** Tool registry the model may call. Empty array = pure chat. */
  tools: ToolDefinition[];
  /**
   * Invoked by the adapter every time the model decides to call a tool.
   * Errors bubble back to the model as an `error: true` result.
   */
  invokeTool: ToolInvoker;
  /** Soft cap on loop iterations (tool calls per user message). */
  maxToolIterations?: number;
}

export interface ChatProvider {
  readonly name: string;
  chat(input: ChatInput): Promise<ChatResult>;
}
