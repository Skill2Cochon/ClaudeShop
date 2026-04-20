'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  generateProductCopyAction,
  type GenerateCopyState,
} from './actions';

interface CopyFormProps {
  productId: string;
  defaultSeed: string;
}

const INITIAL_STATE: GenerateCopyState = { status: 'idle' };

export function CopyForm({ productId, defaultSeed }: CopyFormProps) {
  const boundAction = generateProductCopyAction.bind(null, productId);
  const [state, formAction, isPending] = useActionState<GenerateCopyState, FormData>(
    boundAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div>
          <label
            htmlFor="seed"
            className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Seed description
          </label>
          <textarea
            id="seed"
            name="seed"
            rows={3}
            required
            defaultValue={defaultSeed}
            className="mt-1 w-full rounded-md border bg-background p-3 text-sm"
            placeholder="e.g. Premium organic cotton t-shirt, cut for comfort…"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            1-2 sentences. The model weaves in variant options (size, color, …) automatically.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="tone"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Tone
            </label>
            <select
              id="tone"
              name="tone"
              defaultValue=""
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            >
              <option value="">default (friendly)</option>
              <option value="friendly">friendly</option>
              <option value="premium">premium</option>
              <option value="technical">technical</option>
              <option value="playful">playful</option>
              <option value="minimal">minimal</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="locales"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Locales
            </label>
            <input
              id="locales"
              name="locales"
              defaultValue="en,fr"
              placeholder="en,fr,de"
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Up to 4, comma-separated.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Generating…' : 'Generate copy'}
          </Button>
          {state.status === 'ok' ? (
            <span className="text-xs text-muted-foreground">
              model: <code>{state.payload.model}</code> · in{' '}
              {state.payload.usage.inputTokens}t · out {state.payload.usage.outputTokens}t
              {state.payload.usage.cachedInputTokens !== undefined
                ? ` · cache ${state.payload.usage.cachedInputTokens}t`
                : ''}
            </span>
          ) : null}
        </div>
      </form>

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}

      {state.status === 'ok' ? (
        <div className="space-y-3">
          {state.payload.locales.map((loc) => (
            <article key={loc.locale} className="rounded-lg border bg-card p-4">
              <header className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {loc.locale.toUpperCase()} — {loc.name}
                </h3>
                <span className="text-xs text-muted-foreground">{loc.tagline}</span>
              </header>
              <p className="text-sm text-foreground/90">{loc.description}</p>
              <div className="mt-3 rounded border bg-muted/40 p-2 text-xs">
                <p>
                  <span className="font-semibold">SEO title:</span> {loc.seo.title}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">SEO desc:</span> {loc.seo.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
