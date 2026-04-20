import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listPromotions } from '@/lib/api';

export const dynamic = 'force-dynamic';

const TYPE_BADGE: Record<string, string> = {
  PERCENTAGE: 'bg-emerald-100 text-emerald-900',
  FIXED_AMOUNT: 'bg-sky-100 text-sky-900',
  FREE_SHIPPING: 'bg-purple-100 text-purple-900',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-900',
  DRAFT: 'bg-muted text-muted-foreground',
  DISABLED: 'bg-yellow-100 text-yellow-900',
  EXPIRED: 'bg-red-100 text-red-900',
};

export default async function PromotionsListPage() {
  const { items, total } = await listPromotions({ limit: 100 });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            {total} code{total === 1 ? '' : 's'} · Phase 7 — percentage, fixed amount,
            free shipping.
          </p>
        </div>
        <Link href="/promotions/new">
          <Button>Create promotion</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No promotions yet. Create one to issue a discount code.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const valueDisplay =
              p.type === 'PERCENTAGE'
                ? `${p.value}% off`
                : p.type === 'FIXED_AMOUNT'
                  ? `${(p.value / 100).toFixed(2)} ${p.currency ?? ''} off`
                  : 'Free shipping';
            return (
              <li key={p.id}>
                <Link
                  href={`/promotions/${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                        {p.code}
                      </code>
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {valueDisplay}
                      {p.redemptionCount > 0
                        ? ` · ${p.redemptionCount} redeemed`
                        : ''}
                      {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[p.status] ?? ''}`}
                    >
                      {p.status}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_BADGE[p.type] ?? ''}`}
                    >
                      {p.type}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
