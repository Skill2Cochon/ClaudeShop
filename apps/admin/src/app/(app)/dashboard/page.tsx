import Link from 'next/link';
import { getAnalyticsOverview, type AnalyticsOverview } from '@/lib/api';

export const dynamic = 'force-dynamic';

const WINDOW_PRESETS = [
  { id: '7', days: 7, label: 'Last 7 days' },
  { id: '30', days: 30, label: 'Last 30 days' },
  { id: '90', days: 90, label: 'Last 90 days' },
] as const;

type WindowPreset = (typeof WINDOW_PRESETS)[number];

interface DashboardPageProps {
  searchParams?: Promise<{ window?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const sp = (await searchParams) ?? {};
  const preset: WindowPreset =
    WINDOW_PRESETS.find((p) => p.id === sp.window) ?? WINDOW_PRESETS[1];

  // Fetch both the current window and the preceding window of the
  // same length in parallel, so the KPI cards can render a MoM-style
  // delta arrow without a second round-trip on first paint. If
  // either fetch fails we fall back to single-window rendering.
  const [current, previous] = await Promise.all([
    getAnalyticsOverview({ days: preset.days, topLimit: 5 }).catch(() => null),
    getAnalyticsOverview({ days: preset.days * 2, topLimit: 5 }).catch(() => null),
  ]);

  if (!current) {
    return <DashboardSkeleton />;
  }

  // previous-period revenue = revenue in the N-day window ending
  // `preset.days` ago. The /overview endpoint returns bucketed
  // data so we can just drop the most-recent `preset.days` buckets
  // and sum the rest.
  const priorRevenueCents = summariseRevenueCents(
    (previous?.revenue.buckets ?? []).slice(0, -preset.days),
  );
  const priorOrders = (previous?.revenue.buckets ?? [])
    .slice(0, -preset.days)
    .reduce((acc, b) => acc + b.orderCount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {preset.label.toLowerCase()} · live data from your orders, inventory, and
            fulfilment pipeline.
          </p>
        </div>
        <nav
          aria-label="Select window"
          className="flex shrink-0 gap-1 rounded-lg border bg-card p-1"
        >
          {WINDOW_PRESETS.map((p) => {
            const active = p.id === preset.id;
            return (
              <Link
                key={p.id}
                href={`/dashboard?window=${p.id}`}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {p.label.replace('Last ', '')}
              </Link>
            );
          })}
        </nav>
      </header>

      <KpiRow
        overview={current}
        priorRevenueCents={priorRevenueCents}
        priorOrders={priorOrders}
        windowDays={preset.days}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueChart overview={current} />
        <OrderStatusPanel overview={current} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AovSparkline overview={current} />
        <TopProductsPanel overview={current} />
      </div>

      <InventoryHealthPanel overview={current} />
    </div>
  );
}

/** Sum "12.34"-style bucket revenue strings into an integer cents total. */
function summariseRevenueCents(
  buckets: Array<{ revenue: string }>,
): number {
  let cents = 0;
  for (const b of buckets) {
    cents += Math.round(Number.parseFloat(b.revenue) * 100);
  }
  return cents;
}

function pctDelta(currentCents: number, priorCents: number): number | null {
  if (priorCents === 0) return null;
  return ((currentCents - priorCents) / priorCents) * 100;
}

function formatDelta(pct: number | null): {
  label: string;
  tone: 'up' | 'down' | 'flat' | 'n/a';
} {
  if (pct === null) return { label: 'no prior data', tone: 'n/a' };
  if (Math.abs(pct) < 0.5) return { label: 'flat vs prior', tone: 'flat' };
  const sign = pct > 0 ? '↑' : '↓';
  const magnitude = Math.abs(pct);
  const formatted = magnitude >= 100 ? magnitude.toFixed(0) : magnitude.toFixed(1);
  return {
    label: `${sign} ${formatted}% vs prior`,
    tone: pct > 0 ? 'up' : 'down',
  };
}

function KpiRow({
  overview,
  priorRevenueCents,
  priorOrders,
  windowDays,
}: {
  overview: AnalyticsOverview;
  priorRevenueCents: number;
  priorOrders: number;
  windowDays: number;
}) {
  const currentRevenueCents = Math.round(
    Number.parseFloat(overview.revenue.total) * 100,
  );
  const currentAovCents =
    overview.revenue.orderCount > 0
      ? Math.round(currentRevenueCents / overview.revenue.orderCount)
      : 0;
  const priorAovCents = priorOrders > 0 ? Math.round(priorRevenueCents / priorOrders) : 0;

  const revenueDelta = formatDelta(pctDelta(currentRevenueCents, priorRevenueCents));
  const orderDelta = formatDelta(pctDelta(overview.revenue.orderCount, priorOrders));
  const aovDelta = formatDelta(pctDelta(currentAovCents, priorAovCents));

  const aov = (currentAovCents / 100).toFixed(2);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={`Revenue (${windowDays}d)`}
        value={`${overview.revenue.total} ${overview.revenue.currency}`}
        delta={revenueDelta}
      />
      <StatCard
        label="Paid orders"
        value={overview.revenue.orderCount.toString()}
        delta={orderDelta}
      />
      <StatCard
        label="Avg order value"
        value={`${aov} ${overview.revenue.currency}`}
        delta={aovDelta}
      />
      <StatCard
        label="Out of stock"
        value={overview.inventory.outOfStockCount.toString()}
        tone={overview.inventory.outOfStockCount > 0 ? 'warn' : 'neutral'}
      />
    </div>
  );
}

/**
 * AOV per day — one row per bucket, value = revenue / orderCount
 * (zero when no orders). Same bar visual as the revenue chart so
 * the two can be read side-by-side. When AOV is flat the chart
 * collapses to hairlines rather than showing a noisy full-height
 * row — the emptiness is meaningful signal.
 */
function AovSparkline({ overview }: { overview: AnalyticsOverview }) {
  const buckets = overview.revenue.buckets;
  if (buckets.length === 0) {
    return (
      <PanelShell title="Avg order value · per day" cols={1}>
        <p className="text-sm text-muted-foreground">
          No paid orders in the window yet.
        </p>
      </PanelShell>
    );
  }
  const perDayAov = buckets.map((b) => {
    const rev = Number.parseFloat(b.revenue);
    return b.orderCount > 0 ? rev / b.orderCount : 0;
  });
  const peak = Math.max(...perDayAov);
  const overallAov =
    overview.revenue.orderCount > 0
      ? Number.parseFloat(overview.revenue.total) / overview.revenue.orderCount
      : 0;
  return (
    <PanelShell title="Avg order value · per day" cols={1}>
      <div className="flex h-32 items-end gap-1">
        {buckets.map((b, i) => {
          const value = perDayAov[i] ?? 0;
          const heightPct =
            peak === 0 ? 0 : Math.max(2, Math.round((value / peak) * 100));
          const label = `${b.date}: ${value.toFixed(2)} ${overview.revenue.currency} · ${b.orderCount} orders`;
          return (
            <div
              key={b.date}
              title={label}
              className="flex-1 rounded-t bg-sky-500/70 transition-colors hover:bg-sky-600"
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{buckets[0]?.date}</span>
        <span className="font-mono">
          window AOV · {overallAov.toFixed(2)} {overview.revenue.currency}
        </span>
        <span>{buckets[buckets.length - 1]?.date}</span>
      </div>
    </PanelShell>
  );
}

function RevenueChart({ overview }: { overview: AnalyticsOverview }) {
  const buckets = overview.revenue.buckets;
  if (buckets.length === 0) {
    return (
      <PanelShell title={`Revenue · last ${overview.window.days} days`} cols={2}>
        <p className="text-sm text-muted-foreground">
          No paid orders in the window yet.
        </p>
      </PanelShell>
    );
  }
  const peak = Math.max(...buckets.map((b) => Number.parseFloat(b.revenue)));
  return (
    <PanelShell title={`Revenue · last ${overview.window.days} days`} cols={2}>
      <div className="flex h-40 items-end gap-1">
        {buckets.map((b) => {
          const value = Number.parseFloat(b.revenue);
          const heightPct = peak === 0 ? 0 : Math.max(2, Math.round((value / peak) * 100));
          return (
            <div
              key={b.date}
              title={`${b.date}: ${b.revenue} ${overview.revenue.currency} · ${b.orderCount} orders`}
              className="flex-1 rounded-t bg-foreground/80 transition-colors hover:bg-foreground"
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{buckets[0]?.date}</span>
        <span>{buckets[buckets.length - 1]?.date}</span>
      </div>
    </PanelShell>
  );
}

function OrderStatusPanel({ overview }: { overview: AnalyticsOverview }) {
  const entries = Object.entries(overview.orderStatus.counts).sort(
    (a, b) => b[1] - a[1],
  );
  const total = entries.reduce((acc, [, n]) => acc + n, 0);
  return (
    <PanelShell title="Orders by status" cols={1}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders in the window.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([status, count]) => {
            const pct = total === 0 ? 0 : Math.round((count / total) * 100);
            return (
              <li key={status} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase">{status}</span>
                  <span className="text-muted-foreground">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

function TopProductsPanel({ overview }: { overview: AnalyticsOverview }) {
  return (
    <PanelShell title="Top products by revenue" cols={1}>
      {overview.topProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No paid orders to rank from yet.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {overview.topProducts.map((p, i) => (
            <li key={p.productId}>
              <Link
                href={`/products/${encodeURIComponent(p.productId)}`}
                className="flex items-center justify-between rounded border bg-background p-2 transition-colors hover:border-foreground/20"
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    #{i + 1}
                  </span>{' '}
                  <span className="font-semibold">{p.productName}</span>{' '}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.sku}
                  </span>
                </span>
                <span className="ml-3 shrink-0 text-right">
                  <div className="text-xs font-semibold">
                    {p.revenue} {overview.revenue.currency}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.qty} sold
                  </div>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function InventoryHealthPanel({ overview }: { overview: AnalyticsOverview }) {
  const i = overview.inventory;
  const cells: { label: string; value: number; tone: 'neutral' | 'warn' | 'critical' }[] = [
    { label: 'Total variants', value: i.totalVariants, tone: 'neutral' },
    {
      label: 'Out of stock',
      value: i.outOfStockCount,
      tone: i.outOfStockCount > 0 ? 'critical' : 'neutral',
    },
    {
      label: 'Low stock',
      value: i.lowStockCount,
      tone: i.lowStockCount > 0 ? 'warn' : 'neutral',
    },
    { label: 'Overstock', value: i.overstockCount, tone: 'neutral' },
  ];
  return (
    <PanelShell title="Inventory health" cols={1}>
      <div className="grid gap-2 sm:grid-cols-2">
        {cells.map((c) => (
          <div
            key={c.label}
            className={`rounded border p-3 ${
              c.tone === 'critical'
                ? 'border-destructive/40 bg-destructive/5'
                : c.tone === 'warn'
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'bg-background'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-1 text-xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Tip: open{' '}
        <Link href="/purchase-orders/new" className="underline">
          a draft purchase order
        </Link>{' '}
        for any variant on the low/out list.
      </p>
    </PanelShell>
  );
}

function PanelShell({
  title,
  cols,
  children,
}: {
  title: string;
  cols: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-card p-5 ${cols === 2 ? 'lg:col-span-2' : ''}`}
    >
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
  delta,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warn';
  delta?: { label: string; tone: 'up' | 'down' | 'flat' | 'n/a' };
}) {
  const deltaClass = delta
    ? delta.tone === 'up'
      ? 'text-emerald-700'
      : delta.tone === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground'
    : '';
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === 'warn' ? 'border-yellow-300 bg-yellow-50' : 'bg-card'
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {delta ? (
        <div className={`mt-1 text-[11px] font-medium ${deltaClass}`}>
          {delta.label}
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Couldn't load analytics — is the API reachable?
        </p>
      </div>
    </div>
  );
}
