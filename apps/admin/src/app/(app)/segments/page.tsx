import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listSegments } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SegmentsListPage() {
  const { items, total } = await listSegments({ limit: 100 });
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer segments</h1>
          <p className="text-sm text-muted-foreground">
            {total} segment{total === 1 ? '' : 's'} · Phase 11 — rule-based audiences
            for email campaigns.
          </p>
        </div>
        <Link href="/segments/new">
          <Button>Create segment</Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No segments yet. Create one to target an email campaign.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/segments/${encodeURIComponent(s.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  {s.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold">
                    {s.customerCount} customer{s.customerCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.refreshedAt
                      ? `refreshed ${new Date(s.refreshedAt).toLocaleDateString()}`
                      : 'never refreshed'}
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
