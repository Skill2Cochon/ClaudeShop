import Link from 'next/link';
import { listOrders } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-900',
  PAID: 'bg-green-100 text-green-900',
  FULFILLING: 'bg-blue-100 text-blue-900',
  SHIPPED: 'bg-indigo-100 text-indigo-900',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-red-100 text-red-900',
  REFUNDED: 'bg-orange-100 text-orange-900',
};

/**
 * Phase 2.5 payments list — derived from Order rows (we don't yet expose a
 * /v1/payments API endpoint). Shows every order with a payment lifecycle so
 * ops can see what's outstanding, collected, or needs attention.
 */
export default async function PaymentsPage() {
  let orders: Awaited<ReturnType<typeof listOrders>>['items'] = [];
  let error: string | null = null;

  try {
    const res = await listOrders({ limit: 100 });
    orders = res.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load payments';
  }

  const buckets = {
    pending: orders.filter((o) => o.status === 'PENDING_PAYMENT'),
    paid: orders.filter((o) => o.status === 'PAID' || o.status === 'FULFILLING' || o.status === 'SHIPPED' || o.status === 'DELIVERED'),
    failed: orders.filter((o) => o.status === 'CANCELLED'),
    refunded: orders.filter((o) => o.status === 'REFUNDED'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? 's' : ''} · {buckets.pending.length} pending
          · {buckets.paid.length} collected · {buckets.failed.length} failed ·{' '}
          {buckets.refunded.length} refunded
        </p>
      </div>

      {error ? (
        <ErrorPanel message={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Pending payment" count={buckets.pending.length} color="yellow" />
            <KpiCard label="Collected" count={buckets.paid.length} color="green" />
            <KpiCard label="Failed / cancelled" count={buckets.failed.length} color="red" />
            <KpiCard label="Refunded" count={buckets.refunded.length} color="orange" />
          </div>

          <div className="rounded-lg border bg-card">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                All payments (newest first)
              </h2>
            </header>
            {orders.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No orders yet — run the golden path on the storefront to see payments here.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${o.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {o.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            STATUS_BADGE[o.status] ?? 'bg-muted'
                          }`}
                        >
                          {o.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.anonymousEmail ?? o.customerId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {o.totals.total} {o.currency}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'yellow' | 'green' | 'red' | 'orange';
}) {
  const dot = {
    yellow: 'bg-yellow-400',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
  }[color];
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{count}</div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-semibold text-destructive">API unreachable</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}
