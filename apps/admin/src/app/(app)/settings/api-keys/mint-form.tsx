'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import { mintApiKeyAction, type MintState } from './actions';

const INITIAL: MintState = { status: 'idle' };

export function MintForm() {
  const [state, formAction, isPending] = useActionState<MintState, FormData>(
    mintApiKeyAction,
    INITIAL,
  );

  return (
    <div className="space-y-3">
      <form action={formAction} className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            name="name"
            required
            placeholder="zapier-prod"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Scopes (comma-separated)
          </label>
          <input
            name="scopes"
            placeholder="read:products, write:orders"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Minting…' : 'Mint new key'}
          </Button>
        </div>
      </form>

      {state.status === 'error' ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}

      {state.status === 'ok' ? (
        <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs">
          <p className="font-semibold text-amber-900">
            ⚠ Copy this key now — you won't see it again.
          </p>
          <pre className="overflow-x-auto rounded border bg-white p-2 font-mono text-[11px]">
            {state.rawKey}
          </pre>
          <p className="text-amber-900">
            Stored as <code className="font-mono">{state.row.prefix}…</code> in the table
            below.
          </p>
        </div>
      ) : null}
    </div>
  );
}
