import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { searchProductsByQuery, type SearchProductHit } from '@/lib/api';
import { isLocale, resolveLocalized, type Locale } from '@/lib/i18n';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = pickQuery(q);
  if (!query) return { title: 'Search' };
  return {
    title: `Search results for "${query}"`,
    description: `Products matching "${query}" — ranked by semantic similarity.`,
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { q } = await searchParams;
  const query = pickQuery(q);

  const hits = query ? await searchProductsByQuery(query, { limit: 24 }) : [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {query ? `Results for "${query}"` : 'Search'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {query
            ? `${hits.length} product${hits.length === 1 ? '' : 's'} ranked by semantic similarity.`
            : 'Use the search bar above to find products by meaning, not just keywords.'}
        </p>
      </header>

      {query && hits.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No products match that query. Try different wording — semantic search understands
          intent, so &ldquo;warm winter layer&rdquo; works even if no product literally says
          those words.
        </div>
      ) : null}

      {hits.length > 0 ? <ResultsGrid hits={hits} locale={locale} /> : null}
    </main>
  );
}

function pickQuery(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ResultsGrid({
  hits,
  locale,
}: {
  hits: SearchProductHit[];
  locale: Locale;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hits.map((h) => {
        const name = resolveLocalized(h.name, locale);
        return (
          <li key={h.productId}>
            <Link
              href={`/${locale}/p/${encodeURIComponent(h.slug)}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold">{name}</p>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold">
                  {h.similarity.toFixed(3)}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {h.slug}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
