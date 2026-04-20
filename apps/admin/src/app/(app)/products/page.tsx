import Link from 'next/link';
import { listProducts, searchProductsByQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q.trim() : '';

  const searching = query.length > 0;
  const [{ items, total }, search] = await Promise.all([
    searching ? Promise.resolve({ items: [], total: 0 }) : listProducts({ limit: 50 }),
    searching
      ? searchProductsByQuery(query, { limit: 20 })
      : Promise.resolve({ hits: [], meta: null }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <Link
              href="/products/import"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              Bulk import
            </Link>
            <a
              href="/api/products/export"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              Export CSV
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            {searching ? (
              <>
                {search.hits.length} result{search.hits.length === 1 ? '' : 's'} for{' '}
                <code>{query}</code>
                {search.meta
                  ? ` · ${search.meta.model} · dim ${search.meta.dimensions}`
                  : ''}
              </>
            ) : (
              <>
                {total} product{total === 1 ? '' : 's'} · Phase 4.2 — semantic search live
              </>
            )}
          </p>
        </div>
      </header>

      <form
        action="/products"
        className="flex items-center gap-2 rounded-lg border bg-card p-3"
      >
        <input
          name="q"
          defaultValue={query}
          placeholder="Semantic search: 'black cotton tee', 'warm winter layer', …"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
        {searching ? (
          <Link
            href="/products"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {searching ? (
        <SearchHits hits={search.hits} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No products yet. Create one via the API (<code>POST /v1/products</code>) to see it
          appear here.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const displayName =
              p.name.en ?? p.name.fr ?? Object.values(p.name)[0] ?? '(untitled)';
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${encodeURIComponent(p.id)}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{displayName}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        p.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-900'
                          : p.status === 'DRAFT'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-yellow-100 text-yellow-900'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.slug}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.variants.length} variant{p.variants.length === 1 ? '' : 's'} · {p.type}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SearchHits({
  hits,
}: {
  hits: Awaited<ReturnType<typeof searchProductsByQuery>>['hits'];
}) {
  if (hits.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
        No products match that query. Try different wording, or reindex your products from
        the product detail page.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {hits.map((h) => {
        const displayName = h.name.en ?? h.name.fr ?? Object.values(h.name)[0] ?? '(untitled)';
        return (
          <li key={h.productId}>
            <Link
              href={`/products/${encodeURIComponent(h.productId)}`}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {h.slug}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold">
                  sim {h.similarity.toFixed(3)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    h.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-900'
                      : h.status === 'DRAFT'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-yellow-100 text-yellow-900'
                  }`}
                >
                  {h.status}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
