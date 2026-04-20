'use server';

import { adminFetch } from '@/lib/server-fetch';

export interface CopilotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotToolInvocation {
  name: string;
  input: unknown;
  output: string;
  error: boolean;
}

export interface CopilotToolInfo {
  name: string;
  description: string;
  risk: 'read' | 'mutating';
}

export interface CopilotUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CopilotTurnResult {
  text: string;
  toolInvocations: CopilotToolInvocation[];
  model: string;
  usage: CopilotUsage;
  truncated: boolean;
  tools: CopilotToolInfo[];
  writeUnlocked: boolean;
}

interface ApiError {
  error?: { message?: string };
}

export async function sendCopilotMessageAction(payload: {
  message: string;
  history: CopilotTurn[];
  allowMutations?: boolean;
}): Promise<
  | { status: 'ok'; result: CopilotTurnResult }
  | { status: 'error'; message: string }
> {
  try {
    const res = await adminFetch(`/v1/admin/copilot/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message: payload.message,
        history: payload.history,
        allowMutations: payload.allowMutations ?? false,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      return {
        status: 'error',
        message: body?.error?.message ?? `Copilot request failed (${res.status})`,
      };
    }

    const body = (await res.json()) as { data: CopilotTurnResult };
    return { status: 'ok', result: body.data };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
