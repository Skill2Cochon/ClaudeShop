import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@claudeshop/ui';
import { getOrder } from '@/lib/api';
import { formatPrice, isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function OrderConfirmedPage({ params }: Props) {
  const { locale, id } = await params;
  const cookieLocale = isLocale(locale) ? locale : 'en';

  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        [{cookieLocale}] · Order placed
      </p>
      <h1 className="text-balance text-4xl font-bold tracking-tight">
        Thank you — your order is in 🎉
      </h1>
      <p className="text-lg text-muted-foreground">
        Order <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{order.number}</code> ·
        status <code className="rounded bg-muted px-1.5 py-0.5">{order.status}</code>
      </p>

      <section className="rounded-lg border bg-card p-6 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Items
        </h2>
        <ul className="mt-3 space-y-2">
          {order.lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between text-sm">
              <span>
                {l.productName || l.sku || l.variantId} · ×{l.qty}
              </span>
              <span className="font-medium">
                {formatPrice(l.total, order.currency, cookieLocale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-lg font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.totals.total, order.currency, cookieLocale)}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={`/${cookieLocale}`}>
          <Button size="lg" variant="outline">
            Back to store
          </Button>
        </Link>
        {order.anonymousEmail ? (
          <Link
            href={`/${cookieLocale}/track?number=${encodeURIComponent(order.number)}&email=${encodeURIComponent(order.anonymousEmail)}`}
          >
            <Button size="lg">Track this order →</Button>
          </Link>
        ) : (
          <Link href={`/${cookieLocale}/track`}>
            <Button size="lg">Track an order →</Button>
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Bookmark the tracking page — you can come back any time with your
        order number and email.
      </p>
    </main>
  );
}
