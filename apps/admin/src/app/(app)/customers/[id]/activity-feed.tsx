import Link from 'next/link';
import type { CustomerNote } from '@claudeshop/contracts/customer';
import type { Order } from '@claudeshop/contracts/order';
import { relativeTime } from '@claudeshop/ui';
import { listCustomerNotes } from '@/lib/api';

interface ActivityFeedProps {
  customerId: string;
  /** Orders already fetched by the detail page — reuse to avoid a round-trip. */
  orders: Order[];
}

/**
 * Phase 56 — unified chronological activity feed. Merges notes +
 * orders (and later more signals) into a single timeline so a
 * support rep reading the customer detail page sees "Sarah replied
 * to the ticket · 2h ago" right next to "Order CS-00042 placed · 4h
 * ago" instead of jumping between panels.
 *
 * Notes are fetched fresh here; orders are passed down from the
 * parent so we don't round-trip twice. Future signals (segment
 * changes, address CRUD, campaign sends) slot in by widening the
 * Entry union and adding a collector.
 */
export async function ActivityFeed({ customerId, orders }: ActivityFeedProps) {
  const { items: notes } = await listCustomerNotes(customerId, { limit: 50 });
  const entries = mergeEntries(notes, orders);

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Activity · {entries.length}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Unified timeline — notes + orders, newest first. Internal only.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          No activity yet. The first note you add or the first order this
          customer places will land here.
        </p>
      ) : (
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.key} className="px-4 py-3">
              <EntryRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Entry =
  | {
      kind: 'note';
      key: string;
      at: string;
      note: CustomerNote;
    }
  | {
      kind: 'order';
      key: string;
      at: string;
      order: Order;
    };

function mergeEntries(notes: CustomerNote[], orders: Order[]): Entry[] {
  const noteEntries: Entry[] = notes.map((n) => ({
    kind: 'note',
    key: `note-${n.id}`,
    at: n.createdAt,
    note: n,
  }));
  const orderEntries: Entry[] = orders.map((o) => ({
    kind: 'order',
    key: `order-${o.id}`,
    at: o.placedAt ?? o.createdAt,
    order: o,
  }));
  return [...noteEntries, ...orderEntries].sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}

const ORDER_STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-900',
  PENDING_PAYMENT: 'bg-amber-100 text-amber-900',
  PAID: 'bg-emerald-100 text-emerald-900',
  FULFILLING: 'bg-sky-100 text-sky-900',
  SHIPPED: 'bg-indigo-100 text-indigo-900',
  DELIVERED: 'bg-emerald-200 text-emerald-900',
  CANCELLED: 'bg-red-100 text-red-900',
  REFUNDED: 'bg-orange-100 text-orange-900',
};

function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === 'note') {
    const n = entry.note;
    const isSystem = n.authorType === 'system';
    return (
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-fuchsia-100 text-fuchsia-900'
          }`}
          aria-hidden
        >
          {isSystem ? '⚙' : '📝'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold">
              {n.authorName}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isSystem ? 'system note' : 'note'}
              </span>
            </span>
            <span
              className="text-muted-foreground"
              title={new Date(n.createdAt).toLocaleString()}
            >
              {relativeTime(n.createdAt)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>
        </div>
      </div>
    );
  }

  // kind === 'order'
  const o = entry.order;
  const badgeClass = ORDER_STATUS_CLASS[o.status] ?? 'bg-muted';
  const at = o.placedAt ?? o.createdAt;
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-900"
        aria-hidden
      >
        $
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span>
            <Link
              href={`/orders/${o.id}`}
              className="font-mono font-semibold hover:underline"
            >
              {o.number}
            </Link>
            <span
              className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badgeClass}`}
            >
              {o.status.replaceAll('_', ' ')}
            </span>
          </span>
          <span
            className="text-muted-foreground"
            title={new Date(at).toLocaleString()}
          >
            {relativeTime(at)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Order placed · {o.lines.length} line{o.lines.length === 1 ? '' : 's'}{' '}
          · <span className="font-medium text-foreground">
            {o.totals.total} {o.currency}
          </span>
        </p>
      </div>
    </div>
  );
}
