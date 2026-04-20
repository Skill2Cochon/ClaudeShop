import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@claudeshop/ui';
import { getOrder } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/session';
import { formatPrice, isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

const STATUS_COPY: Record<string, { title: string; body: string; tone: string }> = {
  DRAFT: {
    title: 'Draft',
    body: 'Order still being prepared.',
    tone: 'bg-slate-100 text-slate-900',
  },
  PENDING_PAYMENT: {
    title: 'Awaiting payment',
    body: 'We\'re waiting for your payment to clear.',
    tone: 'bg-amber-100 text-amber-900',
  },
  PAID: {
    title: 'Paid',
    body: 'Payment received. We\'ll start packing this order shortly.',
    tone: 'bg-emerald-100 text-emerald-900',
  },
  FULFILLING: {
    title: 'Being packed',
    body: 'Your order is in the warehouse being picked and packed.',
    tone: 'bg-sky-100 text-sky-900',
  },
  SHIPPED: {
    title: 'Shipped',
    body: 'Your order has left the warehouse.',
    tone: 'bg-indigo-100 text-indigo-900',
  },
  DELIVERED: {
    title: 'Delivered',
    body: 'Our carrier confirmed delivery.',
    tone: 'bg-emerald-200 text-emerald-900',
  },
  CANCELLED: {
    title: 'Cancelled',
    body: 'This order was cancelled.',
    tone: 'bg-red-100 text-red-900',
  },
  REFUNDED: {
    title: 'Refunded',
    body: 'Your refund has been issued.',
    tone: 'bg-orange-100 text-orange-900',
  },
};

/**
 * Phase 40 — logged-in customer order detail. Replaces the old flow
 * where /account/orders linked into /order/:id/confirmed (which still
 * greets returning buyers with "Thank you 🎉" months after the fact).
 *
 * Ownership guard: the order must be associated with the session's
 * email. We compare case-insensitively against anonymousEmail because
 * guest-checkout orders that later "claim" via account registration
 * still keep the original anonymousEmail on the Order row. A
 * mismatch → 404, NOT a 403, so the endpoint can't be used to probe
 * "does order X exist" across tenants.
 */
export default async function AccountOrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const order = await getOrder(id);
  if (!order) notFound();

  // Ownership check — the customer should only ever see their own
  // orders through this surface. Merchants use /admin/orders/:id.
  const orderEmail = order.anonymousEmail?.trim().toLowerCase() ?? null;
  const sessionEmail = session.email.trim().toLowerCase();
  if (orderEmail !== sessionEmail) {
    notFound();
  }

  const status = STATUS_COPY[order.status] ?? STATUS_COPY.DRAFT;
  const statusCopy = status ?? {
    title: order.status,
    body: 'Status pending.',
    tone: 'bg-muted text-foreground',
  };
  const placed = order.placedAt
    ? new Date(order.placedAt).toLocaleString()
    : null;
  const updated = new Date(order.updatedAt).toLocaleString();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-2">
        <Link
          href={`/${locale}/account/orders`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Order history
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Order
            </p>
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {order.number}
            </h1>
            {placed ? (
              <p className="text-xs text-muted-foreground">Placed {placed}</p>
            ) : null}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusCopy.tone}`}
          >
            {statusCopy.title}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{statusCopy.body}</p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Items</h2>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Product</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit</th>
              <th className="py-2 font-medium text-right">Line</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">
                  <span className="block">{line.productName}</span>
                  <span className="block text-[11px] font-mono text-muted-foreground">
                    {line.sku}
                  </span>
                </td>
                <td className="py-2 text-right">{line.qty}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatPrice(line.unitPrice, order.currency, locale)}
                </td>
                <td className="py-2 text-right tabular-nums font-medium">
                  {formatPrice(line.total, order.currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Totals</h2>
        <dl className="space-y-2 text-sm">
          <TotalsRow
            label="Subtotal"
            value={formatPrice(order.totals.subtotal, order.currency, locale)}
          />
          {Number.parseFloat(order.totals.shipping) > 0 ? (
            <TotalsRow
              label="Shipping"
              value={formatPrice(order.totals.shipping, order.currency, locale)}
            />
          ) : null}
          {Number.parseFloat(order.totals.tax) > 0 ? (
            <TotalsRow
              label="Tax"
              value={formatPrice(order.totals.tax, order.currency, locale)}
            />
          ) : null}
          {Number.parseFloat(order.totals.discount) > 0 ? (
            <TotalsRow
              label="Discount"
              value={`− ${formatPrice(order.totals.discount, order.currency, locale)}`}
            />
          ) : null}
          <TotalsRow
            label="Total"
            value={formatPrice(order.totals.total, order.currency, locale)}
            emphasised
          />
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-5 text-xs text-muted-foreground">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Timeline</h2>
        <ul className="space-y-1">
          <li>
            <span className="font-semibold">Placed:</span> {placed ?? '—'}
          </li>
          <li>
            <span className="font-semibold">Last updated:</span> {updated}
          </li>
          <li>
            <span className="font-semibold">Current status:</span>{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {order.status}
            </code>
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${locale}/track?number=${encodeURIComponent(order.number)}&email=${encodeURIComponent(session.email)}`}
        >
          <Button variant="outline">Public tracking page →</Button>
        </Link>
        <Link
          href={`/${locale}/account/orders`}
          className="text-xs text-muted-foreground hover:underline"
        >
          Back to all orders
        </Link>
      </div>
    </main>
  );
}

function TotalsRow({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        emphasised
          ? 'border-t pt-2 text-base font-semibold'
          : 'text-xs text-muted-foreground'
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
