'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createPageAction,
  updatePageAction,
  type PageFormState,
} from './actions';

const INITIAL: PageFormState = { status: 'idle' };

interface PageFormProps {
  pageId?: string;
  initial?: {
    slug: string;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    title: Record<string, string>;
    body: Record<string, string>;
  };
}

export function PageForm({ pageId, initial }: PageFormProps) {
  const isEdit = Boolean(pageId);
  const boundAction = isEdit
    ? updatePageAction.bind(null, pageId!)
    : createPageAction;

  const [state, formAction, isPending] = useActionState<PageFormState, FormData>(
    boundAction,
    INITIAL,
  );

  const titleDefault = JSON.stringify(initial?.title ?? { en: '' }, null, 2);
  const bodyDefault = JSON.stringify(initial?.body ?? { en: '# Hello\n\nYour page body in Markdown.' }, null, 2);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Slug
        </label>
        <input
          name="slug"
          required
          defaultValue={initial?.slug ?? ''}
          pattern="[a-z0-9-]+"
          placeholder="about-us"
          className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Lowercase letters, digits, and hyphens. Surfaces as /{'{slug}'} on the storefront.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Title (per locale)
          </label>
          <textarea
            name="title"
            rows={4}
            required
            defaultValue={titleDefault}
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            JSON object — e.g. <code>{`{"en":"About","fr":"À propos"}`}</code>
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <select
            name="status"
            defaultValue={initial?.status ?? 'DRAFT'}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="DRAFT">DRAFT — not visible on storefront</option>
            <option value="PUBLISHED">PUBLISHED — live on storefront</option>
            <option value="ARCHIVED">ARCHIVED — hidden, kept for history</option>
          </select>
          {isEdit ? (
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input type="checkbox" name="publish" />
              <span>Publish now (overrides status)</span>
            </label>
          ) : null}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Body (Markdown per locale)
        </label>
        <textarea
          name="body"
          rows={14}
          required
          defaultValue={bodyDefault}
          className="mt-1 w-full rounded-md border bg-background p-3 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          JSON object keyed by locale — each value is a Markdown string.
        </p>
      </div>

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}
      {state.status === 'ok' ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create page'}
      </Button>
    </form>
  );
}
