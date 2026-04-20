import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@claudeshop/ui';
import { trackGuestOrder, type TrackedOrder } from '@/lib/api';
import { isLocale, formatPrice } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface TrackPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ number?: string; email?: string }>;
}

const STATUS_COPY: Record<string, { title: string; body: string; tone: string }> = {
  DRAFT: {
    title: 'Draft',
    body: 'Order is still being prepared — payment not collected yet.',
    tone: 'bg-slate-100 text-slate-900',
  },
  PENDING_PAYMENT: {
    title: 'Awaiting payment',
    body: 'We\'re waiting for your payment to clear. Check your checkout tab or email for the payment link.',
    tone: 'bg-amber-100 text-amber-900',
  },
  PAID: {
    title: 'Paid',
    body: 'Payment received. We\'ll start packing your order shortly.',
    tone: 'bg-emerald-100 text-emerald-900',
  },
  FULFILLING: {
    title: 'Being packed',
    body: 'Your order is in our warehouse being picked and packed.',
    tone: 'bg-sky-100 text-sky-900',
  },
  SHIPPED: {
    title: 'Shipped',
    body: 'Your order has left the warehouse. You should have a tracking email.',
    tone: 'bg-indigo-100 text-indigo-900',
  },
  DELIVERED: {
    title: 'Delivered',
    body: 'Our carrier says this one arrived. Enjoy!',
    tone: 'bg-emerald-200 text-emerald-900',
  },
  CANCELLED: {
    title: 'Cancelled',
    body: 'This order was cancelled. Reach out to support if that looks wrong.',
    tone: 'bg-red-100 text-red-900',
  },
  REFUNDED: {
    title: 'Refunded',
    body: 'Your refund has been issued. Funds typically arrive within 5–10 business days.',
    tone: 'bg-orange-100 text-orange-900',
  },
};

/**
 * Phase 36 — guest-facing order tracking. The querystring IS the
 * form state, which means a guest can bookmark the page and come
 * back later without retyping anything. We don't persist anything
 * server-side; the lookup re-runs on every load.
 */
export default async function TrackOrderPage({
  params,
  searchParams,
}: TrackPageProps) {
  const { locale } = await params;
  const cookieLocale = isLocale(locale) ? locale : 'en';
  const q = (await searchParams) ?? {};
  const number = q.number?.trim() ?? '';
  const email = q.email?.trim() ?? '';

  const hasQuery = number.length > 0 && email.length > 0;
  let tracked: TrackedOrder | null = null;
  let lookupError: string | null = null;

  if (hasQuery) {
    try {
      tracked = await trackGuestOrder(number, email);
    } catch (err) {
      lookupError = err instanceof Error ? err.message : 'Lookup failed.';
    }
  }

  const notFound = hasQuery && !tracked && !lookupError;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          [{cookieLocale}] · Order tracking
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Track your order</h1>
        <p className="text-sm text-muted-foreground">
          Enter the order number from your confirmation email and the email
          you used at checkout.
        </p>
      </header>

      <form
        method="get"
        action={`/${cookieLocale}/track`}
        className="space-y-4 rounded-lg border bg-card p-5"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Order number</span>
            <input
              name="number"
              defaultValue={number}
              placeholder="CS-00042"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={email}
              placeholder="you@example.com"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        <Button type="submit" size="lg" className="w-full">
          Look up order
        </Button>
      </form>

      {lookupError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {lookupError}
        </div>
      ) : null}

      {notFound ? (
        <div className="rounded-lg border bg-card p-6 text-sm">
          <p className="font-semibold">No order found</p>
          <p className="mt-1 text-muted-foreground">
            Double-check both fields — the number and email must both match
            what&apos;s on your confirmation. If it still doesn&apos;t work,
            reach out to support.
          </p>
        </div>
      ) : null}

      {tracked ? (
        <TrackedOrderCard order={tracked} locale={cookieLocale} />
      ) : null}

      <footer className="text-center text-xs text-muted-foreground">
        <Link href={`/${cookieLocale}`} className="hover:underline">
          ← Back to shopping
        </Link>
      </footer>
    </main>
  );
}

function TrackedOrderCard({
  order,
  locale,
}: {
  order: TrackedOrder;
  locale: string;
}) {
  const status = STATUS_COPY[order.status] ?? STATUS_COPY.DRAFT;
  const statusCopy = status ?? {
    title: order.status,
    body: 'Status update pending.',
    tone: 'bg-muted text-foreground',
  };
  const placedAt = order.placedAt
    ? new Date(order.placedAt).toLocaleString()
    : null;
  return (
    <section className="space-y-5 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Order
          </p>
          <p className="font-mono text-lg font-semibold">{order.number}</p>
          {placedAt ? (
            <p className="text-xs text-muted-foreground">Placed {placedAt}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusCopy.tone}`}
        >
          {statusCopy.title}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{statusCopy.body}</p>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Item</th>
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

      <dl className="grid gap-2 border-t pt-4 text-sm">
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
        emphasised ? 'border-t pt-2 text-base font-semibold' : 'text-xs text-muted-foreground'
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
