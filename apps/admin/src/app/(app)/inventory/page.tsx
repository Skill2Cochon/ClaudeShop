import Link from 'next/link';
import { adminFetch } from '@/lib/server-fetch';
import {
  adjustStockAction,
  sendLowStockDigestAction,
  setSafetyStockAction,
} from './actions';

export const dynamic = 'force-dynamic';

interface InventoryRow {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: Record<string, string>;
  sku: string;
  locationId: string;
  onHand: number;
  reserved: number;
  safetyStock: number;
  available: number;
  updatedAt: string;
}

interface InventoryList {
  data: InventoryRow[];
  meta: { page: number; limit: number; total: number };
}

interface InventorySummary {
  data: { total: number; outOfStock: number; lowStock: number; healthy: number };
}

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

async function fetchList(filter: 'all' | 'low' | 'out'): Promise<InventoryList> {
  const params = new URLSearchParams({ limit: '100' });
  if (filter === 'low') params.set('lowOnly', 'true');
  if (filter === 'out') params.set('outOfStockOnly', 'true');
  const res = await adminFetch(`/v1/admin/inventory?${params.toString()}`);
  if (!res.ok) return { data: [], meta: { page: 1, limit: 100, total: 0 } };
  return (await res.json()) as InventoryList;
}

async function fetchSummary(): Promise<InventorySummary['data']> {
  const res = await adminFetch('/v1/admin/inventory/summary');
  if (!res.ok) return { total: 0, outOfStock: 0, lowStock: 0, healthy: 0 };
  return ((await res.json()) as InventorySummary).data;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const { filter: filterRaw } = await searchParams;
  const filter: 'all' | 'low' | 'out' =
    filterRaw === 'low' ? 'low' : filterRaw === 'out' ? 'out' : 'all';

  const [list, summary] = await Promise.all([fetchList(filter), fetchSummary()]);

  // Forward the same filter to the export so the downloaded CSV
  // matches what the merchant is looking at.
  const exportQs = new URLSearchParams();
  if (filter === 'low') exportQs.set('lowOnly', 'true');
  if (filter === 'out') exportQs.set('outOfStockOnly', 'true');
  const exportHref = exportQs.toString()
    ? `/api/inventory/export?${exportQs.toString()}`
    : '/api/inventory/export';
  const exportDisabled = list.meta.total === 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Phase 20 — onHand / reserved / safety stock with inline receive, shrinkage and
            safety-stock edits. Out-of-stock + low-stock chips for the merchant&apos;s daily triage.
          </p>
        </div>
        {exportDisabled ? (
          <span className="inline-flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
            Export CSV (empty)
          </span>
        ) : (
          <a
            href={exportHref}
            className="inline-flex h-9 shrink-0 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            Export CSV
          </a>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Tracked variants" value={summary.total} />
        <KpiCard
          label="Healthy"
          value={summary.healthy}
          tone="emerald"
        />
        <KpiCard
          label="Low stock"
          value={summary.lowStock}
          tone="amber"
          href="/inventory?filter=low"
        />
        <KpiCard
          label="Out of stock"
          value={summary.outOfStock}
          tone="red"
          href="/inventory?filter=out"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterLink current={filter} value="all" label="All" />
        <FilterLink current={filter} value="low" label="Low stock" />
        <FilterLink current={filter} value="out" label="Out of stock" />
        <span className="ml-auto text-xs text-muted-foreground">
          {list.data.length} / {list.meta.total} rows
        </span>
      </div>

      <LowStockDigestPanel
        hasSomethingToDigest={summary.lowStock + summary.outOfStock > 0}
      />

      {list.data.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          {filter === 'all'
            ? 'No inventory rows yet. Seed the demo tenant or receive stock from a purchase order.'
            : filter === 'low'
              ? 'Nothing below the safety-stock threshold — good job!'
              : 'Nothing out of stock right now.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.data.map((row) => (
            <InventoryRowCard key={row.variantId} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'amber' | 'red';
  href?: string;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-foreground';
  const body = (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: string;
  value: 'all' | 'low' | 'out';
  label: string;
}) {
  const active = current === value;
  const href = value === 'all' ? '/inventory' : `/inventory?filter=${value}`;
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'hover:border-foreground/30'
      }`}
    >
      {label}
    </Link>
  );
}

function InventoryRowCard({ row }: { row: InventoryRow }) {
  const displayName =
    row.productName.en ?? row.productName.fr ?? Object.values(row.productName)[0] ?? row.sku;
  const outOfStock = row.onHand === 0;
  const low = !outOfStock && row.available <= 0;
  const adjustBound = adjustStockAction.bind(null, row.variantId);
  const safetyBound = setSafetyStockAction.bind(null, row.variantId);

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {row.sku} · <Link href={`/products/${row.productId}`} className="hover:underline">
              {row.productSlug}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {outOfStock ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-900">
              Out of stock
            </span>
          ) : low ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
              Low stock
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
              Healthy
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            loc {row.locationId}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
        <Cell label="On hand" value={row.onHand} />
        <Cell label="Reserved" value={row.reserved} />
        <Cell label="Safety" value={row.safetyStock} />
        <Cell label="Available" value={row.available} tone={row.available <= 0 ? 'warn' : 'ok'} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <form action={adjustBound} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Adjust (±)
            </label>
            <input
              name="delta"
              type="number"
              step="1"
              placeholder="+10 or -2"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reason
            </label>
            <input
              name="reason"
              placeholder="Shrinkage, recount, return…"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Apply
          </button>
        </form>

        <form action={safetyBound} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Safety stock threshold
            </label>
            <input
              name="safetyStock"
              type="number"
              min="0"
              step="1"
              defaultValue={row.safetyStock}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Save
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Phase 52 — manual trigger for the low-stock digest email. The API
 * resolves the recipient from settings.storefront.supportEmail when
 * the `to` input is blank, so merchants who've wired that once get
 * a one-click send. A filled-in `to` overrides for ad-hoc sends
 * ("forward this to the warehouse partner").
 *
 * Disabled state when the catalog has nothing below safety —
 * firing an empty digest would just clutter the recipient's
 * inbox. The API also refuses empty digests server-side so this
 * guard is purely UX polish.
 */
function LowStockDigestPanel({
  hasSomethingToDigest,
}: {
  hasSomethingToDigest: boolean;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Low-stock digest</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasSomethingToDigest
              ? 'Send a ranked list of out-of-stock + below-safety variants to the team.'
              : 'Nothing below safety right now — digest would be empty.'}
          </p>
        </div>
        <form action={sendLowStockDigestAction} className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="email"
            name="to"
            placeholder="override recipient (optional)"
            className="w-56 rounded-md border bg-background px-2 py-1.5"
          />
          <button
            type="submit"
            disabled={!hasSomethingToDigest}
            className="rounded-md border bg-foreground px-3 py-1.5 font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send digest now
          </button>
        </form>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn' | 'ok';
}) {
  const toneClass =
    tone === 'warn'
      ? 'text-red-700'
      : tone === 'ok'
        ? 'text-emerald-700'
        : 'text-foreground';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
