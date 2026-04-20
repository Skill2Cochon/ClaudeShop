import Link from 'next/link';
import { WebhookForm } from '../webhook-form';

export const dynamic = 'force-dynamic';

export default function NewWebhookPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/webhooks" className="text-xs text-muted-foreground hover:underline">
          ← All webhooks
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New webhook</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <WebhookForm />
      </section>
    </div>
  );
}
