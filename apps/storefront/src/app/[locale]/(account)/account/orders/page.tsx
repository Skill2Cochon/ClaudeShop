import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { OrderStatus } from '@claudeshop/contracts/order';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { listOrdersByCustomer } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order history' };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ status?: string }>;
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-900',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-900',
  FULFILLING: 'bg-blue-100 text-blue-900',
  SHIPPED: 'bg-purple-100 text-purple-900',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-muted text-muted-foreground',
  REFUNDED: 'bg-red-100 text-red-900',
  DRAFT: 'bg-muted text-muted-foreground',
};

/**
 * Phase 47 — buckets a customer actually thinks in. "Active"
 * collapses everything currently in flight (paid, fulfilling,
 * shipped) so the default view matches the mental model "what am I
 * waiting on right now?". "Done" is delivered + completed, and the
 * raw statuses stay accessible behind explicit chips for anyone who
 * wants finer control.
 */
const FILTER_PRESETS: Array<{
  id: string;
  label: string;
  statuses: OrderStatus[] | null;
}> = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'active', label: 'In progress', statuses: ['PAID', 'FULFILLING', 'SHIPPED'] },
  { id: 'delivered', label: 'Delivered', statuses: ['DELIVERED'] },
  { id: 'pending', label: 'Awaiting payment', statuses: ['PENDING_PAYMENT', 'DRAFT'] },
  { id: 'cancelled', label: 'Cancelled / refunded', statuses: ['CANCELLED', 'REFUNDED'] },
];

export default async function OrderHistoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const sp = (await searchParams) ?? {};
  const preset =
    FILTER_PRESETS.find((p) => p.id === sp.status) ?? FILTER_PRESETS[0]!;

  // The /v1/orders endpoint takes a single status, so we issue one
  // request per status in the preset and merge. Presets have at most
  // 3 statuses → 3 round-trips in the worst case, still cheap for a
  // page that only runs when the customer explicitly lands on it.
  const orders = preset.statuses
    ? (
        await Promise.all(
          preset.statuses.map((status) =>
            listOrdersByCustomer(session.email, { limit: 50, status }),
          ),
        )
      )
        .flat()
        .sort((a, b) => {
          const at = a.placedAt ?? a.createdAt;
          const bt = b.placedAt ?? b.createdAt;
          return bt.localeCompare(at);
        })
    : await listOrdersByCustomer(session.email, { limit: 50 });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Order history</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length === 1 ? '' : 's'}
          {preset.id !== 'all' ? ` matching “${preset.label.toLowerCase()}”` : ''} ·{' '}
          placed with <code>{session.email}</code>.
        </p>
      </header>

      <nav
        aria-label="Filter orders by status"
        className="flex flex-wrap gap-2 rounded-lg border bg-card p-2"
      >
        {FILTER_PRESETS.map((p) => {
          const active = p.id === preset.id;
          const href =
            p.id === 'all'
              ? `/${locale}/account/orders`
              : `/${locale}/account/orders?status=${p.id}`;
          return (
            <Link
              key={p.id}
              href={href}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                active
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          {preset.id === 'all'
            ? 'No orders yet. Once you check out, your orders will show up here.'
            : `No orders match “${preset.label.toLowerCase()}”. Try a different filter.`}
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${locale}/account/orders/${encodeURIComponent(o.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{o.number}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {o.placedAt ? new Date(o.placedAt).toLocaleString() : 'Not placed yet'} ·{' '}
                    {o.lines.length} item{o.lines.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">
                    {o.totals.total} {o.currency}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[o.status] ?? ''}`}
                  >
                    {o.status.replaceAll('_', ' ')}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
