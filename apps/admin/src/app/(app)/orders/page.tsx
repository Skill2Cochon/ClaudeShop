import Link from 'next/link';
import type { OrderStatus } from '@claudeshop/contracts/order';
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

const STATUS_OPTIONS: OrderStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

interface OrdersPageProps {
  searchParams?: Promise<{
    status?: string;
    numberQuery?: string;
    customerId?: string;
    customerEmail?: string;
    placedFrom?: string;
    placedTo?: string;
    page?: string;
  }>;
}

/**
 * Phase 37 — filterable admin orders list. The URL is the state:
 * every filter is a querystring param, so deep links from other
 * surfaces (customer detail → "View all orders", audit log entry →
 * order in question) just work without a client-side context.
 */
export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = (await searchParams) ?? {};
  const status = STATUS_OPTIONS.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;
  const numberQuery = params.numberQuery?.trim() || undefined;
  const customerId = params.customerId?.trim() || undefined;
  const customerEmail = params.customerEmail?.trim() || undefined;
  const placedFrom = /^\d{4}-\d{2}-\d{2}$/.test(params.placedFrom ?? '')
    ? params.placedFrom
    : undefined;
  const placedTo = /^\d{4}-\d{2}-\d{2}$/.test(params.placedTo ?? '')
    ? params.placedTo
    : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const anyFilter = Boolean(
    status || numberQuery || customerId || customerEmail || placedFrom || placedTo,
  );

  let items: Awaited<ReturnType<typeof listOrders>>['items'] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const res = await listOrders({
      page,
      limit: 50,
      ...(status ? { status } : {}),
      ...(numberQuery ? { numberQuery } : {}),
      ...(customerId ? { customerId } : {}),
      ...(customerEmail ? { customerEmail } : {}),
      ...(placedFrom ? { placedFrom } : {}),
      ...(placedTo ? { placedTo } : {}),
    });
    items = res.items;
    total = res.total;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load orders';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Phase 37 · {total.toLocaleString()} total · {items.length} shown.
            Filter by status, order number, customer, or date range.
          </p>
        </div>
        <ExportCsvLink filters={params} disabled={total === 0} />
      </header>

      <form
        action="/orders"
        method="get"
        className="grid gap-3 rounded-lg border bg-card p-4 text-xs md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]"
      >
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Order #
          </span>
          <input
            name="numberQuery"
            defaultValue={numberQuery ?? ''}
            placeholder="CS-00042"
            className="w-full rounded-md border bg-background px-2 py-1.5 font-mono"
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="w-full rounded-md border bg-background px-2 py-1.5"
          >
            <option value="">Any</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Customer email
          </span>
          <input
            name="customerEmail"
            type="email"
            defaultValue={customerEmail ?? ''}
            placeholder="buyer@example.com"
            className="w-full rounded-md border bg-background px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Placed between
          </span>
          <div className="flex gap-1">
            <input
              name="placedFrom"
              type="date"
              defaultValue={placedFrom ?? ''}
              className="w-full rounded-md border bg-background px-2 py-1.5"
            />
            <input
              name="placedTo"
              type="date"
              defaultValue={placedTo ?? ''}
              className="w-full rounded-md border bg-background px-2 py-1.5"
            />
          </div>
        </label>
        {/* Preserve the customerId pin — it's deep-linked from the
            customer detail page. Users who just want to clear the
            filter click "Reset" below. */}
        {customerId ? (
          <input type="hidden" name="customerId" value={customerId} />
        ) : null}
        <button
          type="submit"
          className="self-end rounded-md border bg-foreground px-3 py-1.5 font-semibold text-background hover:opacity-90"
        >
          Filter
        </button>
        <Link
          href="/orders"
          className="self-end rounded-md border px-3 py-1.5 text-center text-muted-foreground hover:bg-muted"
        >
          Reset
        </Link>
      </form>

      {customerId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Pinned to customer{' '}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono">
            {customerId}
          </code>{' '}
          —{' '}
          <Link href="/orders" className="underline hover:no-underline">
            clear pin
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">API unreachable</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Start the infra: <code className="rounded bg-muted px-1">pnpm docker:up</code>, then the
            API: <code className="rounded bg-muted px-1">pnpm --filter @claudeshop/api dev</code>.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium">
            {anyFilter ? 'No orders match these filters.' : 'No orders yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {anyFilter
              ? 'Try widening the date range or clearing a filter.'
              : 'Place a test order from the storefront cart page to see it here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Items</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        STATUS_BADGE[order.status] ?? 'bg-muted'
                      }`}
                    >
                      {order.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {order.customerId ? (
                      <Link
                        href={`/customers/${order.customerId}`}
                        className="hover:underline"
                      >
                        {order.anonymousEmail ?? order.customerId}
                      </Link>
                    ) : (
                      (order.anonymousEmail ?? '—')
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">{order.lines.length}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {order.totals.total} {order.currency}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {order.placedAt
                      ? new Date(order.placedAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > items.length ? (
        <Pagination page={page} total={total} limit={50} params={params} />
      ) : null}
    </div>
  );
}

function ExportCsvLink({
  filters,
  disabled,
}: {
  filters: Record<string, string | undefined>;
  disabled: boolean;
}) {
  // Forward the exact on-screen filters (minus pagination) to the
  // export endpoint so the download reflects what the merchant is
  // looking at. Limited upstream to 5000 rows — anything more
  // requires narrowing the date range.
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v && k !== 'page') qp.set(k, v);
  }
  const href = qp.toString()
    ? `/api/orders/export?${qp.toString()}`
    : '/api/orders/export';

  if (disabled) {
    return (
      <span className="inline-flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
        Export CSV (empty)
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex h-9 shrink-0 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
    >
      Export CSV
    </a>
  );
}

function Pagination({
  page,
  total,
  limit,
  params,
}: {
  page: number;
  total: number;
  limit: number;
  params: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const buildHref = (next: number): string => {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== 'page') qp.set(k, v);
    }
    qp.set('page', String(next));
    return `/orders?${qp.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            ← Prev
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={buildHref(page + 1)}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
