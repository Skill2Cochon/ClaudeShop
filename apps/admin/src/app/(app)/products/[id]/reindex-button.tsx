'use client';

import { useState, useTransition } from 'react';
import { Button } from '@claudeshop/ui';
import { reindexProductAction, type ReindexState } from './actions';

export function ReindexButton({ productId }: { productId: string }) {
  const [state, setState] = useState<ReindexState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await reindexProductAction(productId);
      setState(result);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClick}
          disabled={isPending}
        >
          {isPending ? 'Indexing…' : 'Reindex semantic search'}
        </Button>
        {state.status === 'ok' ? (
          <span className="text-xs text-muted-foreground">
            {state.payload.model} · dim {state.payload.dimensions} ·{' '}
            {state.payload.inputTokens}t input
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span className="text-xs text-destructive">{state.message}</span>
        ) : null}
      </div>
      {state.status === 'ok' ? (
        <details className="rounded border bg-muted/40 p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            Indexed search text (preview)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {state.payload.searchTextPreview}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
