import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listSuppliers } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SuppliersListPage() {
  const { items, total } = await listSuppliers({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            {total} supplier{total === 1 ? '' : 's'} · Phase 10 — purchase orders + stock
            reception.
          </p>
        </div>
        <Link href="/suppliers/new">
          <Button>Create supplier</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No suppliers yet. Add one to start drafting purchase orders.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/suppliers/${encodeURIComponent(s.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.contactEmail ?? '—'} · {s.currency} · NET {s.paymentTermsDays}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    s.isActive
                      ? 'bg-green-100 text-green-900'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
