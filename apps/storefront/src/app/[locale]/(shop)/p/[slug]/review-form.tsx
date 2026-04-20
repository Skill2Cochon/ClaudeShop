'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  submitReviewAction,
  type ReviewFormState,
} from './review-actions';

const INITIAL: ReviewFormState = { status: 'idle' };

interface ReviewFormProps {
  productId: string;
  locale: string;
  slug: string;
  signedIn: boolean;
}

export function ReviewForm({ productId, locale, slug, signedIn }: ReviewFormProps) {
  const bound = submitReviewAction.bind(null, productId, locale, slug);
  const [state, formAction, isPending] = useActionState<ReviewFormState, FormData>(
    bound,
    INITIAL,
  );

  if (!signedIn) {
    return (
      <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <a href={`/${locale}/login`} className="underline">
          Sign in
        </a>{' '}
        to leave a review.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border bg-card p-4">
      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating
        </legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded border bg-background px-3 py-1 text-sm hover:border-foreground/40"
            >
              <input type="radio" name="rating" value={n} className="sr-only" required />
              {'★'.repeat(n)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label
          htmlFor="title"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Title (optional)
        </label>
        <input
          id="title"
          name="title"
          maxLength={200}
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="body"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Your review
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={5000}
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
        />
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

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  );
}
