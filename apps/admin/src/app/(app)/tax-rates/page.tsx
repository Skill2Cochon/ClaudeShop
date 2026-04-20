import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listTaxRates } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TaxRatesListPage() {
  const { items, total } = await listTaxRates({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tax rates</h1>
          <p className="text-sm text-muted-foreground">
            {total} rate{total === 1 ? '' : 's'} · Phase 8 — admin CRUD; checkout
            integration lands in 8.1.
          </p>
        </div>
        <Link href="/tax-rates/new">
          <Button>Create tax rate</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No tax rates yet. Add one per region you sell into.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const pct = (r.rateBp / 100).toFixed(2);
            return (
              <li key={r.id}>
                <Link
                  href={`/tax-rates/${encodeURIComponent(r.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.countryCode}
                      {r.regionCode ? ` · ${r.regionCode}` : ''}
                      {r.postcodePattern ? ` · postcode ${r.postcodePattern}` : ''}
                      · priority {r.priority}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold">{pct}%</span>
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
