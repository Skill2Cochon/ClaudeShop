import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getOrder, listOrderPayments, type PaymentRow } from '@/lib/api';
import { FulfilmentBar } from './fulfilment-bar';
import { NotesSection } from './notes-section';

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

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  let order: Awaited<ReturnType<typeof getOrder>> = null;
  let payments: PaymentRow[] = [];
  let error: string | null = null;

  try {
    const [orderResult, paymentsResult] = await Promise.all([
      getOrder(id),
      listOrderPayments(id),
    ]);
    order = orderResult;
    payments = paymentsResult;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load order';
  }

  if (!error && !order) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted-foreground">
        <Link href="/orders" className="hover:underline">
          Orders
        </Link>
        <span className="mx-2">·</span>
        <span>{order?.number ?? id}</span>
      </nav>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">API unreachable</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : order ? (
        <>
          <header className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Order{' '}
                <span className="font-mono text-xl">{order.number}</span>
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    STATUS_BADGE[order.status] ?? 'bg-muted'
                  }`}
                >
                  {order.status.replaceAll('_', ' ')}
                </span>
                <span>
                  {order.placedAt
                    ? new Date(order.placedAt).toLocaleString()
                    : 'Not placed yet'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Mark shipped
              </Button>
            </div>
          </header>

          <section className="rounded-lg border bg-card p-5">
            <header className="mb-3">
              <h2 className="text-base font-semibold">Fulfilment</h2>
              <p className="text-xs text-muted-foreground">
                Phase 31 · Move the order through its lifecycle. Cancelling a reserved
                order releases the stock; marking shipped commits the reservation to on-hand.
                Transitions are audited.
              </p>
            </header>
            <FulfilmentBar orderId={order.id} current={order.status} />
          </section>

          <PaymentsHistory payments={payments} currency={order.currency} />

          <RefundPanel orderId={order.id} status={order.status} currency={order.currency} />

          <NotesSection orderId={order.id} />

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="space-y-6 lg:col-span-2">
              <div className="rounded-lg border bg-card">
                <header className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Line items · {order.lines.length}
                  </h2>
                </header>
                <ul className="divide-y">
                  {order.lines.map((line) => (
                    <li key={line.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {line.productName || '(unnamed product)'}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {line.sku || line.variantId}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {line.unitPrice} × {line.qty}
                      </div>
                      <div className="w-28 text-right text-sm font-medium">
                        {line.total} {order.currency}
                      </div>
                    </li>
                  ))}
                </ul>
                <footer className="space-y-1 border-t bg-muted/30 px-4 py-3 text-sm">
                  <TotalRow label="Subtotal" value={order.totals.subtotal} currency={order.currency} />
                  <TotalRow label="Tax" value={order.totals.tax} currency={order.currency} />
                  <TotalRow
                    label="Discount"
                    value={`-${order.totals.discount}`}
                    currency={order.currency}
                  />
                  <TotalRow
                    label="Shipping"
                    value={order.totals.shipping}
                    currency={order.currency}
                  />
                  <TotalRow
                    label="Total"
                    value={order.totals.total}
                    currency={order.currency}
                    bold
                  />
                </footer>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <InfoRow label="Email" value={order.anonymousEmail ?? '—'} />
                  <InfoRow label="Customer id" value={order.customerId ?? 'Guest'} />
                </dl>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Metadata
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <InfoRow label="Order id" value={order.id} mono />
                  <InfoRow label="Number" value={order.number} mono />
                  <InfoRow label="Currency" value={order.currency} />
                  <InfoRow label="Tenant" value={order.tenantId} mono />
                  <InfoRow
                    label="Created"
                    value={new Date(order.createdAt).toLocaleString()}
                  />
                  <InfoRow
                    label="Updated"
                    value={new Date(order.updatedAt).toLocaleString()}
                  />
                </dl>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

const PAYMENT_STATUS_BADGE: Record<PaymentRow['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-900',
  AUTHORIZED: 'bg-blue-100 text-blue-900',
  CAPTURED: 'bg-green-100 text-green-900',
  FAILED: 'bg-red-100 text-red-900',
  REFUNDED: 'bg-orange-100 text-orange-900',
  PARTIALLY_REFUNDED: 'bg-amber-100 text-amber-900',
};

function PaymentsHistory({
  payments,
  currency,
}: {
  payments: PaymentRow[];
  currency: string;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        No payment attempts recorded yet for this order.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Payments · {payments.length}
        </h2>
      </header>
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Provider</th>
            <th className="px-4 py-2 font-medium">Reference</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Amount</th>
            <th className="px-4 py-2 font-medium text-right">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-xs">{p.provider}</td>
              <td className="px-4 py-2 font-mono text-xs">{p.providerRef}</td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYMENT_STATUS_BADGE[p.status]}`}
                >
                  {p.status.replaceAll('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-medium">
                {p.amount} {currency}
              </td>
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                {new Date(p.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REFUNDABLE_STATUSES = new Set(['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED']);

function RefundPanel({
  orderId,
  status,
  currency,
}: {
  orderId: string;
  status: string;
  currency: string;
}) {
  const refundable = REFUNDABLE_STATUSES.has(status);
  return (
    <details className="rounded-lg border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Refund{' '}
        {refundable ? null : (
          <span className="text-xs font-normal text-muted-foreground">
            (not available — order status is {status})
          </span>
        )}
      </summary>
      {refundable ? (
        <form
          action={async (formData) => {
            'use server';
            const { refundOrderAction } = await import('./actions');
            await refundOrderAction(orderId, formData);
          }}
          className="mt-4 space-y-3 text-sm"
        >
          <p className="text-xs text-muted-foreground">
            Provider reference is auto-resolved from the Payment row. Leave the override blank
            unless you need to target a specific PaymentIntent.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="amount" className="text-xs font-medium">
                Amount ({currency}) · empty = full
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="10.00"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reason" className="text-xs font-medium">
                Reason
              </label>
              <select
                id="reason"
                name="reason"
                defaultValue=""
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background"
              >
                <option value="">— none —</option>
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate</option>
                <option value="fraudulent">Fraudulent</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="providerRef" className="text-xs font-medium">
                Override providerRef (optional)
              </label>
              <input
                id="providerRef"
                name="providerRef"
                type="text"
                placeholder="pi_xxxxx"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="destructive">
            Issue refund
          </Button>
        </form>
      ) : null}
    </details>
  );
}

function TotalRow({
  label,
  value,
  currency,
  bold,
}: {
  label: string;
  value: string;
  currency: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? 'text-base font-semibold' : ''}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>
        {value} {currency}
      </span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
