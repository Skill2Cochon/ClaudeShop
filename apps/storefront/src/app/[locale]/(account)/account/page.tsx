import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { listOrdersByCustomer } from '@/lib/api';
import { logoutCustomerAction } from '../../(auth)/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account' };

interface Props {
  params: Promise<{ locale: string }>;
}

interface LifetimeStats {
  orderCount: number;
  lifetimeSpend: number;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

function computeLifetimeStats(
  orders: Awaited<ReturnType<typeof listOrdersByCustomer>>,
): LifetimeStats | null {
  if (orders.length === 0) return null;
  let lifetime = 0;
  let currency = orders[0]?.currency ?? 'EUR';
  let firstAt: string | null = null;
  let lastAt: string | null = null;
  for (const o of orders) {
    const total = Number.parseFloat(o.totals.total);
    if (Number.isFinite(total)) lifetime += total;
    currency = o.currency;
    const placed = o.placedAt ?? o.createdAt;
    if (placed) {
      if (!firstAt || placed < firstAt) firstAt = placed;
      if (!lastAt || placed > lastAt) lastAt = placed;
    }
  }
  return {
    orderCount: orders.length,
    lifetimeSpend: Number(lifetime.toFixed(2)),
    currency,
    firstOrderAt: firstAt,
    lastOrderAt: lastAt,
  };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const orders = await listOrdersByCustomer(session.email, { limit: 200 });
  const stats = computeLifetimeStats(orders);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your account
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight">
            {session.displayName ?? session.email}
          </h1>
          <p className="text-sm text-muted-foreground">{session.email}</p>
        </div>
        <form
          action={async () => {
            'use server';
            await logoutCustomerAction(locale);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Sign out
          </Button>
        </form>
      </header>

      {stats ? (
        <section className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Orders placed"
            value={String(stats.orderCount)}
            hint={
              stats.lastOrderAt
                ? `Last: ${new Date(stats.lastOrderAt).toLocaleDateString()}`
                : undefined
            }
          />
          <StatCard
            label="Lifetime spend"
            value={`${stats.lifetimeSpend.toFixed(2)} ${stats.currency}`}
          />
          <StatCard
            label="Customer since"
            value={
              stats.firstOrderAt
                ? new Date(stats.firstOrderAt).toLocaleDateString()
                : '—'
            }
          />
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/${locale}/account/orders`}
          className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <p className="text-sm font-semibold">Order history</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every order placed with this email across all sessions.
          </p>
        </Link>
        <Link
          href={`/${locale}/account/addresses`}
          className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <p className="text-sm font-semibold">Address book</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved shipping destinations for faster checkout.
          </p>
        </Link>
        <Link
          href={`/${locale}/account/wishlist`}
          className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <p className="text-sm font-semibold">Saved products</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Products you hearted from the storefront.
          </p>
        </Link>
        <Link
          href={`/${locale}/account/security`}
          className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <p className="text-sm font-semibold">Security</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Change your password and manage sign-in.
          </p>
        </Link>
        <Link
          href={`/${locale}`}
          className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <p className="text-sm font-semibold">Keep shopping</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Back to the storefront.
          </p>
        </Link>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
