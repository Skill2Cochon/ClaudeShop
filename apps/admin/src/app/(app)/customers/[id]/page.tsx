import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomer } from '@/lib/api';
import { ActivityFeed } from './activity-feed';
import { NotesSection } from './notes-section';

export const dynamic = 'force-dynamic';

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

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
 * Merchant customer drill-down. Surfaces the three things the merchant
 * actually wants when they click a row: (1) who is this person, (2)
 * what have they spent, (3) what did they buy. The three panels come
 * from a single API call so we don't juggle loading states.
 */
export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  let detail: Awaited<ReturnType<typeof getCustomer>> = null;
  try {
    detail = await getCustomer(id, { orderLimit: 20 });
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const { customer, orders, stats } = detail;
  const fullName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const memberSince = new Date(customer.createdAt).toLocaleDateString();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Customer
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {fullName || '(no name)'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.email} · {customer.phone ?? 'no phone'} ·{' '}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {customer.group}
            </span>
          </p>
        </div>
        <Link
          href="/customers"
          className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          ← All customers
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Lifetime value"
          value={`${stats.lifetimeValue} ${stats.currency}`}
          hint="Sum of PAID / FULFILLING / SHIPPED / DELIVERED totals"
        />
        <StatCard
          label="Orders placed"
          value={stats.orderCount.toLocaleString()}
          hint="All statuses including cancelled"
        />
        <StatCard
          label="First order"
          value={
            stats.firstOrderAt
              ? new Date(stats.firstOrderAt).toLocaleDateString()
              : '—'
          }
          hint={stats.firstOrderAt ? 'Acquired on' : 'No orders yet'}
        />
        <StatCard
          label="Last order"
          value={
            stats.lastOrderAt
              ? new Date(stats.lastOrderAt).toLocaleDateString()
              : '—'
          }
          hint={stats.lastOrderAt ? 'Most recent activity' : '—'}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Account</h2>
          <dl className="space-y-2 text-xs">
            <Row label="Customer ID" value={customer.id} mono />
            <Row label="Member since" value={memberSince} />
            <Row
              label="Marketing"
              value={customer.acceptsMarketing ? 'Opted in' : 'Opted out'}
            />
            <Row label="Group" value={customer.group} />
            <Row label="Email" value={customer.email} />
            <Row label="Phone" value={customer.phone ?? '—'} />
          </dl>
        </div>

        <div className="md:col-span-2 rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Recent orders ({orders.length} of {stats.orderCount})
            </h2>
            {stats.orderCount > orders.length ? (
              <Link
                href={`/orders?customerId=${encodeURIComponent(customer.id)}`}
                className="text-xs text-muted-foreground hover:underline"
              >
                View all →
              </Link>
            ) : null}
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This customer hasn&apos;t placed any orders yet.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b text-left uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Order</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Total</th>
                  <th className="py-2 font-medium text-right">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30">
                    <td className="py-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono hover:underline"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_BADGE[order.status] ?? 'bg-muted'
                        }`}
                      >
                        {order.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {order.totals.total} {order.currency}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {order.placedAt
                        ? new Date(order.placedAt).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ActivityFeed customerId={customer.id} orders={orders} />

      <NotesSection customerId={customer.id} />
    </div>
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
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className={`truncate text-right ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
