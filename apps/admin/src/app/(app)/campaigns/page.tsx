import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listCampaigns } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-sky-100 text-sky-900',
  SENDING: 'bg-yellow-100 text-yellow-900',
  SENT: 'bg-green-100 text-green-900',
  FAILED: 'bg-red-100 text-red-900',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export default async function CampaignsListPage() {
  const { items, total } = await listCampaigns({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email campaigns</h1>
          <p className="text-sm text-muted-foreground">
            {total} campaign{total === 1 ? '' : 's'} · Phase 11 — stub provider; Resend
            adapter lands in 11.1.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>Create campaign</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No campaigns yet. Draft one targeting a customer segment.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campaigns/${encodeURIComponent(c.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.subject}
                    {c.sentAt
                      ? ` · sent ${new Date(c.sentAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {c.sentCount > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {c.sentCount} sent
                      {c.failedCount > 0 ? ` · ${c.failedCount} failed` : ''}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[c.status] ?? ''}`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
