import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listCategories, listProducts } from '@/lib/api';
import { isLocale, resolveLocalized } from '@/lib/i18n';
import { ProductCard } from '@/components/product-card';

const STOREFRONT_CURRENCY = process.env.STOREFRONT_CURRENCY ?? 'EUR';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'All products' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AllProductsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [products, categories] = await Promise.all([
    listProducts({ limit: 60, priceFor: STOREFRONT_CURRENCY }),
    listCategories({ rootOnly: true }),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">All products</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? '' : 's'} ·{' '}
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
        </p>
      </header>

      {categories.length > 0 ? (
        <nav className="flex flex-wrap gap-2 text-xs">
          {categories.map((c) => {
            const name = resolveLocalized(c.name, locale);
            return (
              <Link
                key={c.id}
                href={`/${locale}/c/${encodeURIComponent(c.slug)}`}
                className="rounded-full border bg-card px-3 py-1.5 hover:border-foreground/20"
              >
                {name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No products yet. Check back soon!
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
