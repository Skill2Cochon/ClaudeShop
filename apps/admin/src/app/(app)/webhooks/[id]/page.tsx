import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getWebhookSubscription, listWebhookDeliveries } from '@/lib/api';
import { WebhookForm } from '../webhook-form';
import { deleteWebhookAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  DELIVERED: 'bg-green-100 text-green-900',
  FAILED: 'bg-red-100 text-red-900',
};

export default async function EditWebhookPage({ params }: Props) {
  const { id } = await params;
  const sub = await getWebhookSubscription(id);
  if (!sub) notFound();
  const { items: deliveries } = await listWebhookDeliveries({
    subscriptionId: id,
    limit: 25,
  });

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/webhooks" className="text-xs text-muted-foreground hover:underline">
            ← All webhooks
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {sub.url}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sub.events.length} event{sub.events.length === 1 ? '' : 's'} subscribed
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deleteWebhookAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <WebhookForm
          webhookId={id}
          initial={{
            url: sub.url,
            events: sub.events,
            isActive: sub.isActive,
          }}
        />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3">
          <h2 className="text-sm font-semibold">Recent deliveries (this endpoint)</h2>
          <p className="text-xs text-muted-foreground">
            Phase 14 ships sync delivery; failed rows are retried on the next event of
            the same id (idempotent on subscription, eventId).
          </p>
        </header>
        {deliveries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deliveries yet.</p>
        ) : (
          <ul className="space-y-1">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded border bg-background p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono">
                    {d.eventType} · {d.eventId}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {d.lastAttemptAt
                      ? `attempt ${d.attemptCount} · ${new Date(d.lastAttemptAt).toLocaleString()}`
                      : 'pending'}
                    {d.responseStatus ? ` · HTTP ${d.responseStatus}` : ''}
                    {d.errorMessage ? ` · ${d.errorMessage.slice(0, 60)}` : ''}
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
