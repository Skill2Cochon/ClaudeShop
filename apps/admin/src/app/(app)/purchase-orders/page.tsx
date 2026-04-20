import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listPurchaseOrders } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-sky-100 text-sky-900',
  PARTIAL: 'bg-yellow-100 text-yellow-900',
  RECEIVED: 'bg-green-100 text-green-900',
  CANCELLED: 'bg-red-100 text-red-900',
};

export default async function PurchaseOrdersListPage() {
  const { items, total } = await listPurchaseOrders({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">
            {total} order{total === 1 ? '' : 's'} · Phase 10 — receiving increments
            on-hand stock atomically.
          </p>
        </div>
        <Link href="/purchase-orders/new">
          <Button>Create PO</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No purchase orders yet. Create one for an existing supplier.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((po) => (
            <li key={po.id}>
              <Link
                href={`/purchase-orders/${encodeURIComponent(po.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{po.number}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {po.lines.length} line{po.lines.length === 1 ? '' : 's'} ·{' '}
                    {po.placedAt
                      ? `Sent ${new Date(po.placedAt).toLocaleDateString()}`
                      : 'Not sent'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">
                    {po.total} {po.currency}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[po.status] ?? ''}`}
                  >
                    {po.status}
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
