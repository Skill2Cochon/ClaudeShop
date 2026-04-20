import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listPages } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-900',
  DRAFT: 'bg-muted text-muted-foreground',
  ARCHIVED: 'bg-yellow-100 text-yellow-900',
};

export default async function PagesListPage() {
  const { items, total } = await listPages({ limit: 100 });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CMS pages</h1>
          <p className="text-sm text-muted-foreground">
            {total} page{total === 1 ? '' : 's'} · Phase 6 — merchant-authored
            Markdown content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {total === 0 ? (
            <span className="inline-flex h-9 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
              Export CSV (empty)
            </span>
          ) : (
            <a
              href="/api/pages/export"
              className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              Export CSV
            </a>
          )}
          <Link href="/pages/new">
            <Button>Create page</Button>
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No pages yet. Create one to publish a landing, about, or legal page on the
          storefront.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const titleEn = p.title.en ?? Object.values(p.title)[0] ?? '(untitled)';
            const localeCount = Object.keys(p.title).length;
            return (
              <li key={p.id}>
                <Link
                  href={`/pages/${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{titleEn}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{p.slug} · {localeCount} locale{localeCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[p.status] ?? ''}`}
                  >
                    {p.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
