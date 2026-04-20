'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  subscribeNewsletterAction,
  type NewsletterState,
} from './actions';

const INITIAL: NewsletterState = { status: 'idle' };

interface NewsletterFormProps {
  /** Optional — "footer", "hero", "post-checkout"… attached to audit log. */
  source?: string;
  /** Compact = tight inline row; full = headline + subcopy + stacked form. */
  variant?: 'compact' | 'full';
}

/**
 * Phase 58 — newsletter opt-in with a honeypot, inline success +
 * error states, and optional `source` tag. Uses useActionState so
 * the component stays stateless after success (the action returns
 * 'ok' and the form swaps itself for a thank-you line).
 */
export function NewsletterForm({
  source,
  variant = 'compact',
}: NewsletterFormProps) {
  const [state, formAction, pending] = useActionState<NewsletterState, FormData>(
    subscribeNewsletterAction,
    INITIAL,
  );

  if (state.status === 'ok') {
    return (
      <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
        🎉 You&apos;re on the list. Check your inbox for a welcome note.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      {variant === 'full' ? (
        <>
          <h3 className="text-lg font-semibold">Get our weekly edit</h3>
          <p className="text-sm text-muted-foreground">
            One curated email per week — new drops, thoughtful essays, no spam.
          </p>
        </>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoComplete="email"
          disabled={pending}
        />
        {source ? <input type="hidden" name="source" value={source} /> : null}
        {/* Honeypot — screen readers skip via aria-hidden + off-screen
            position, humans never see it. Bots auto-fill → silent drop. */}
        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden"
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </div>

      {state.status === 'error' ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Unsubscribe anytime — every email has a one-click opt-out link.
        </p>
      )}
    </form>
  );
}
