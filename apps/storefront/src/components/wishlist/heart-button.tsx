'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { toggleWishlistAction } from './actions';

interface HeartButtonProps {
  productId: string;
  locale: string;
  /** Server-resolved initial state — `null` when the user is anonymous. */
  initialFavourited: boolean | null;
}

/**
 * Heart toggle shown next to the PDP title. When the user is anonymous the
 * button still renders — the first click bounces them to /login instead of
 * quietly doing nothing.
 *
 * Optimistic state: we flip the icon immediately on click and only reconcile
 * when the server action resolves. The server action is the single source of
 * truth; if it fails we drop back to the server-confirmed value on the next
 * render.
 */
export function HeartButton({
  productId,
  locale,
  initialFavourited,
}: HeartButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Anonymous users get a "nudge to login" version — no optimistic flip.
  if (initialFavourited === null) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/${locale}/login`)}
        aria-label="Sign in to save this product"
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <HeartIcon filled={false} />
        <span>Sign in to save</span>
      </button>
    );
  }

  const [optimistic, setOptimistic] = useOptimistic(initialFavourited);

  const onClick = () => {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const res = await toggleWishlistAction(productId, locale);
      if (res.status === 'needs-auth') {
        router.push(res.loginHref);
      }
      // When ok, the server-action revalidatePath + router auto-refresh will
      // reconcile on the next render.
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={optimistic}
      aria-label={optimistic ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        optimistic
          ? 'border-rose-400/60 bg-rose-50 text-rose-900 hover:bg-rose-100'
          : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      <HeartIcon filled={optimistic} />
      <span>{optimistic ? 'Saved' : 'Save'}</span>
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      aria-hidden
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
