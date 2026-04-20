'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@claudeshop/ui';
import {
  sendCopilotMessageAction,
  type CopilotTurn,
  type CopilotToolInvocation,
  type CopilotToolInfo,
  type CopilotUsage,
} from './actions';

interface AssistantTurn {
  role: 'assistant';
  content: string;
  toolInvocations: CopilotToolInvocation[];
  model: string;
  usage: CopilotUsage;
  truncated: boolean;
}

interface UserTurn {
  role: 'user';
  content: string;
}

type Turn = UserTurn | AssistantTurn;

const READ_SUGGESTIONS = [
  'How was revenue this month?',
  'What were my top sellers last 7 days?',
  'Any out-of-stock variants I should reorder?',
  'How many orders are stuck in PENDING_PAYMENT?',
];

const WRITE_SUGGESTIONS = [
  'Reindex the first active product',
  'Suggest premium-tone copy in en+fr for my newest product',
  'Find my draft products and propose taglines',
  'Re-embed all products whose copy changed recently',
];

export function CopilotChatView() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [tools, setTools] = useState<CopilotToolInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allowMutations, setAllowMutations] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isPending) return;
    setError(null);

    const history: CopilotTurn[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    const nextUserTurn: UserTurn = { role: 'user', content: trimmed };
    setTurns([...turns, nextUserTurn]);

    startTransition(async () => {
      const res = await sendCopilotMessageAction({
        message: trimmed,
        history,
        allowMutations,
      });
      if (res.status === 'error') {
        setError(res.message);
        return;
      }
      setTools(res.result.tools);
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.result.text,
          toolInvocations: res.result.toolInvocations,
          model: res.result.model,
          usage: res.result.usage,
          truncated: res.result.truncated,
        },
      ]);
    });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const value = input.value;
    input.value = '';
    submit(value);
  };

  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-4">
      <WriteUnlockBar
        allowMutations={allowMutations}
        onToggle={() => setAllowMutations((v) => !v)}
        disabled={isPending}
      />

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-card p-4">
        {turns.length === 0 ? (
          <WelcomePanel onPick={submit} allowMutations={allowMutations} />
        ) : (
          turns.map((t, i) => <TurnBubble key={i} turn={t} tools={tools} />)
        )}
        {isPending ? (
          <div className="text-xs text-muted-foreground">Copilot is thinking…</div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-lg border bg-card p-3">
        <textarea
          ref={inputRef}
          rows={2}
          placeholder="Ask the copilot — 'list active products', 'search for black tee', …"
          className="w-full resize-none rounded-md border bg-background p-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const form = (e.target as HTMLElement).closest('form');
              if (form) form.requestSubmit();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Enter to send · Shift+Enter for newline · {tools.length} tools loaded
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>

      {tools.length > 0 ? (
        <details className="rounded-lg border bg-card p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            Available tools ({tools.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {tools.map((t) => (
              <li key={t.name} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    t.risk === 'read'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-yellow-100 text-yellow-900'
                  }`}
                >
                  {t.risk}
                </span>
                <span>
                  <code className="text-[11px] font-semibold">{t.name}</code> —{' '}
                  <span className="text-muted-foreground">{t.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function WriteUnlockBar({
  allowMutations,
  onToggle,
  disabled,
}: {
  allowMutations: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-xs transition-colors ${
        allowMutations
          ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            allowMutations ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
        />
        <span className="font-semibold">
          {allowMutations ? 'Write access UNLOCKED' : 'Write access LOCKED'}
        </span>
        <span className="text-muted-foreground">
          {allowMutations
            ? '⚠ Mutating tools (reindex, copy generation) run immediately when Claude calls them.'
            : 'Only read-only tools are exposed to the copilot.'}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          allowMutations
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-yellow-500 text-black hover:bg-yellow-600'
        }`}
      >
        {allowMutations ? 'Lock writes' : 'Unlock writes'}
      </button>
    </div>
  );
}

function WelcomePanel({
  onPick,
  allowMutations,
}: {
  onPick: (text: string) => void;
  allowMutations: boolean;
}) {
  const suggestions = allowMutations ? WRITE_SUGGESTIONS : READ_SUGGESTIONS;
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-semibold">Hey — I'm the ClaudeShop Copilot.</p>
        <p className="text-muted-foreground">
          Ask me about your catalog, orders, or installed modules. Unlock writes above to
          let me regenerate embeddings or draft product copy on your behalf.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:border-foreground/20"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnBubble({
  turn,
  tools,
}: {
  turn: Turn;
  tools: CopilotToolInfo[];
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {turn.content}
        </div>
      </div>
    );
  }
  const toolRisk = (name: string): 'read' | 'mutating' =>
    tools.find((t) => t.name === name)?.risk ?? 'read';
  return (
    <div className="space-y-2">
      <div className="max-w-[90%] whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-sm">
        {turn.content.length > 0 ? turn.content : '(no text returned)'}
      </div>
      {turn.toolInvocations.length > 0 ? (
        <div className="max-w-[90%] space-y-2">
          {turn.toolInvocations.map((inv, i) => {
            const risk = toolRisk(inv.name);
            const isMut = risk === 'mutating';
            return (
              <details
                key={i}
                className={`rounded border p-2 text-xs ${
                  inv.error
                    ? 'border-destructive/40 bg-destructive/5'
                    : isMut
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'bg-background'
                }`}
              >
                <summary className="flex cursor-pointer items-center gap-2 font-mono font-semibold">
                  <span>{inv.error ? '⚠' : isMut ? '✎' : '▸'}</span>
                  <span>{inv.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      isMut
                        ? 'bg-yellow-200 text-yellow-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {risk}
                  </span>
                  {inv.error ? (
                    <span className="text-destructive">(error)</span>
                  ) : isMut ? (
                    <span className="text-yellow-900">(executed)</span>
                  ) : null}
                </summary>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                  input: {JSON.stringify(inv.input, null, 2)}
                </pre>
                <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                  {inv.output}
                </pre>
              </details>
            );
          })}
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <code>{turn.model}</code>
        <span>· {turn.usage.inputTokens}→{turn.usage.outputTokens}t</span>
        {turn.usage.cachedInputTokens ? (
          <span>· cache {turn.usage.cachedInputTokens}t</span>
        ) : null}
        {turn.truncated ? (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-900">
            truncated
          </span>
        ) : null}
      </div>
    </div>
  );
}
