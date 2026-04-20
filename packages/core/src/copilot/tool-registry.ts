import { z } from 'zod';
import type { ToolDefinition } from '../ports/chat-provider.js';

/**
 * A copilot tool is a Zod-validated input schema + a handler. The registry
 * pattern lets us ship each tool as a single unit (schema + handler + metadata)
 * and expose both the LLM-facing definition and the execution function.
 */
export interface CopilotTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  /** Hint used by clients to decide whether a confirmation is required. */
  risk: 'read' | 'mutating';
  inputSchema: z.ZodType<Input>;
  handler: (input: Input) => Promise<Output>;
}

export class CopilotToolRegistry {
  private readonly tools = new Map<string, CopilotTool<unknown, unknown>>();

  register<I, O>(tool: CopilotTool<I, O>): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`CopilotToolRegistry: tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool as unknown as CopilotTool<unknown, unknown>);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Definitions surfaced to the LLM for tool-use. */
  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /** Metadata surfaced to clients (e.g. for UI confirmations). */
  listMetadata(): Array<{ name: string; description: string; risk: 'read' | 'mutating' }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      risk: t.risk,
    }));
  }

  /**
   * Return a new registry containing only tools that pass the predicate. The
   * underlying tools are shared by reference — filter() is a view, not a copy.
   */
  filter(predicate: (tool: CopilotTool<unknown, unknown>) => boolean): CopilotToolRegistry {
    const next = new CopilotToolRegistry();
    for (const tool of this.tools.values()) {
      if (predicate(tool)) {
        next.register(tool);
      }
    }
    return next;
  }

  /** Convenience: registry of read-only tools. */
  readOnly(): CopilotToolRegistry {
    return this.filter((t) => t.risk === 'read');
  }

  /**
   * Execute a tool by name. Validates input against the registered Zod schema;
   * validation failures become user-visible errors that the LLM sees as tool
   * errors (and can correct on the next turn).
   */
  async invoke(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool "${name}"`);
    }
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new Error(`Invalid input for tool "${name}": ${details}`);
    }
    return tool.handler(parsed.data);
  }
}
