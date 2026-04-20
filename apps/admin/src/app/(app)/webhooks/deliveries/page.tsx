import Link from 'next/link';
import type { WebhookDeliveryStatus } from '@claudeshop/contracts/webhook';
import {
  listWebhookDeliveries,
  listWebhookSubscriptions,
} from '@/lib/api';
import { redeliverWebhookAction } from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    eventType?: string;
    subscriptionId?: string;
    limit?: string;
  }>;
}

const STATUS_BADGE: Record<WebhookDeliveryStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-red-100 text-red-900',
};

function asStatus(value: string | undefined): WebhookDeliveryStatus | undefined {
  if (value === 'PENDING' || value === 'DELIVERED' || value === 'FAILED') {
    return value;
  }
  return undefined;
}

export default async function WebhookDeliveriesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const eventType = sp.eventType && sp.eventType.length > 0 ? sp.eventType : undefined;
  const subscriptionId =
    sp.subscriptionId && sp.subscriptionId.length > 0 ? sp.subscriptionId : undefined;
  const limit = Number.parseInt(sp.limit ?? '100', 10) || 100;

  const [{ items, total }, { items: subscriptions }] = await Promise.all([
    listWebhookDeliveries({
      limit,
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
    }),
    listWebhookSubscriptions({ limit: 100 }),
  ]);

  const subsById = new Map(subscriptions.map((s) => [s.id, s]));

  // Phase 48 — export forwards the same filters the merchant is
  // looking at so the file matches the on-screen slice.
  const exportQs = new URLSearchParams();
  if (status) exportQs.set('status', status);
  if (eventType) exportQs.set('eventType', eventType);
  if (subscriptionId) exportQs.set('subscriptionId', subscriptionId);
  const exportHref = exportQs.toString()
    ? `/api/webhook-deliveries/export?${exportQs.toString()}`
    : '/api/webhook-deliveries/export';
  const exportDisabled = total === 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/webhooks"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Subscriptions
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Webhook deliveries
          </h1>
          <p className="text-sm text-muted-foreground">
            Phase 28 · Append-only delivery log with filters + one-click manual
            redeliver. Redelivery replays the stored payload with a fresh signature
            through the same HMAC path.
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

      <form
        action="/webhooks/deliveries"
        method="GET"
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4"
      >
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">any</option>
            <option value="PENDING">pending</option>
            <option value="DELIVERED">delivered</option>
            <option value="FAILED">failed</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Event type
          </label>
          <input
            name="eventType"
            defaultValue={eventType ?? ''}
            placeholder="order.placed"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Subscription
          </label>
          <select
            name="subscriptionId"
            defaultValue={subscriptionId ?? ''}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">any</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.url.replace(/^https?:\/\//, '').slice(0, 48)}
                {s.url.length > 55 ? '…' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Apply
          </button>
          <Link
            href="/webhooks/deliveries"
            className="text-xs text-muted-foreground hover:underline"
          >
            Reset
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length} / {total} rows
          </span>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No deliveries match those filters. Try loosening the status filter or pick a
          different subscription.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((delivery) => {
            const sub = subsById.get(delivery.subscriptionId);
            return (
              <li key={delivery.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold uppercase ${STATUS_BADGE[delivery.status]}`}
                  >
                    {delivery.status}
                  </span>
                  <code className="font-mono font-semibold">{delivery.eventType}</code>
                  <span className="text-muted-foreground">·</span>
                  <code className="truncate font-mono text-muted-foreground">
                    {delivery.eventId}
                  </code>
                  <span className="ml-auto text-muted-foreground">
                    attempt {delivery.attemptCount} ·{' '}
                    {delivery.lastAttemptAt
                      ? new Date(delivery.lastAttemptAt).toLocaleString()
                      : new Date(delivery.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                  {sub
                    ? `→ ${sub.url}${sub.isActive ? '' : ' (paused)'}`
                    : `→ subscription ${delivery.subscriptionId} (missing)`}
                </p>

                {delivery.responseStatus !== null ||
                delivery.errorMessage !== null ||
                delivery.responseBody !== null ? (
                  <details className="mt-2 text-[11px]">
                    <summary className="cursor-pointer font-semibold text-muted-foreground">
                      response
                    </summary>
                    {delivery.responseStatus !== null ? (
                      <p className="mt-1 font-mono">
                        HTTP {delivery.responseStatus}
                      </p>
                    ) : null}
                    {delivery.errorMessage ? (
                      <p className="mt-1 rounded bg-red-50 p-2 font-mono text-red-900">
                        {delivery.errorMessage}
                      </p>
                    ) : null}
                    {delivery.responseBody ? (
                      <pre className="mt-1 max-h-48 overflow-x-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[10px]">
                        {delivery.responseBody}
                      </pre>
                    ) : null}
                  </details>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <form
                    action={redeliverWebhookAction.bind(null, delivery.id)}
                  >
                    <button
                      type="submit"
                      disabled={sub ? !sub.isActive : true}
                      title={
                        sub && !sub.isActive
                          ? 'Subscription is paused — re-enable it first.'
                          : undefined
                      }
                      className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Redeliver
                    </button>
                  </form>
                  {sub ? (
                    <Link
                      href={`/webhooks/${encodeURIComponent(sub.id)}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      View subscription
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
