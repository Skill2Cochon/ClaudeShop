import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listShippingRates } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ShippingRatesListPage() {
  const { items, total } = await listShippingRates({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shipping rates</h1>
          <p className="text-sm text-muted-foreground">
            {total} rate{total === 1 ? '' : 's'} · Phase 8 — admin CRUD; cart preview +
            checkout integration in 8.1.
          </p>
        </div>
        <Link href="/shipping-rates/new">
          <Button>Create shipping rate</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No shipping rates yet. Add one per zone you ship into.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/shipping-rates/${encodeURIComponent(r.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {r.countryCodes.join(', ')}
                    {r.estimatedDays ? ` · ${r.estimatedDays}d` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">
                    {(r.basePriceCents / 100).toFixed(2)} {r.currency}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      r.isActive
                        ? 'bg-green-100 text-green-900'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
