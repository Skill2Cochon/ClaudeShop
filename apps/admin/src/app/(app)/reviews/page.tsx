import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listReviews } from '@/lib/api';
import { deleteReviewAction, moderateReviewAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-900',
  APPROVED: 'bg-green-100 text-green-900',
  REJECTED: 'bg-red-100 text-red-900',
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReviewsModerationPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const filter =
    status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING'
      ? status
      : undefined;
  const { items, total } = await listReviews({
    limit: 100,
    ...(filter ? { status: filter } : {}),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            {total} review{total === 1 ? '' : 's'} · Phase 18 — moderate before they
            appear on the storefront.
          </p>
        </div>
        <nav className="flex gap-2 text-xs">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <Link
              key={s}
              href={`/reviews?status=${s}`}
              className={`rounded-full border px-3 py-1.5 ${
                filter === s
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:border-foreground/20'
              }`}
            >
              {s}
            </Link>
          ))}
          <Link
            href="/reviews"
            className={`rounded-full border px-3 py-1.5 ${
              !filter ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground/20'
            }`}
          >
            ALL
          </Link>
        </nav>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No reviews to show.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="space-y-2 rounded-lg border bg-card p-4"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)} {r.title ? `· ${r.title}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.authorName} · product {r.productId} ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[r.status] ?? ''}`}
                >
                  {r.status}
                </span>
              </header>
              {r.body ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {r.body}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {r.status !== 'APPROVED' ? (
                  <form
                    action={async () => {
                      'use server';
                      await moderateReviewAction(r.id, 'APPROVED');
                    }}
                  >
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                ) : null}
                {r.status !== 'REJECTED' ? (
                  <form
                    action={async () => {
                      'use server';
                      await moderateReviewAction(r.id, 'REJECTED');
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                ) : null}
                {r.status !== 'PENDING' ? (
                  <form
                    action={async () => {
                      'use server';
                      await moderateReviewAction(r.id, 'PENDING');
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Re-queue
                    </Button>
                  </form>
                ) : null}
                <form
                  action={async () => {
                    'use server';
                    await deleteReviewAction(r.id);
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
