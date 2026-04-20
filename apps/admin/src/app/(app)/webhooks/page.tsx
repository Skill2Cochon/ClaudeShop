import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listWebhookDeliveries, listWebhookSubscriptions } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  DELIVERED: 'bg-green-100 text-green-900',
  FAILED: 'bg-red-100 text-red-900',
};

export default async function WebhooksListPage() {
  const [{ items: subs, total: subsTotal }, { items: deliveries }] = await Promise.all([
    listWebhookSubscriptions({ limit: 100 }),
    listWebhookDeliveries({ limit: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            {subsTotal} subscription{subsTotal === 1 ? '' : 's'} · Phase 14 — outbound,
            HMAC-SHA256 signed. Phase 14.1 adds retry queue.
          </p>
        </div>
        <Link href="/webhooks/new">
          <Button>Create webhook</Button>
        </Link>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Subscriptions</h2>
        {subs.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
            No webhooks yet. Add one to receive event notifications in your system.
          </div>
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/webhooks/${encodeURIComponent(s.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{s.url}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.events.length} event
                      {s.events.length === 1 ? '' : 's'} ·{' '}
                      {s.events.slice(0, 4).join(', ')}
                      {s.events.length > 4 ? ` +${s.events.length - 4}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      s.isActive
                        ? 'bg-green-100 text-green-900'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {s.isActive ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Recent deliveries</h2>
          <Link
            href="/webhooks/deliveries"
            className="text-xs text-muted-foreground hover:underline"
          >
            View full log + redeliver →
          </Link>
        </div>
        {deliveries.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-xs text-muted-foreground">
            No deliveries yet — events fan out as orders are placed and other actions
            fire.
          </div>
        ) : (
          <ul className="space-y-1">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded border bg-card p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono">
                    {d.eventType} · {d.eventId}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {d.lastAttemptAt
                      ? `attempt ${d.attemptCount} · ${new Date(d.lastAttemptAt).toLocaleString()}`
                      : `created ${new Date(d.createdAt).toLocaleString()}`}
                    {d.responseStatus ? ` · HTTP ${d.responseStatus}` : ''}
                    {d.errorMessage ? ` · ${d.errorMessage.slice(0, 80)}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[d.status] ?? ''}`}
                >
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
