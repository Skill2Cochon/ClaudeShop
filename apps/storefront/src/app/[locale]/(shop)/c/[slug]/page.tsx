import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategoryBySlug, listCategoryProducts } from '@/lib/api';
import { isLocale, resolveLocalized } from '@/lib/i18n';
import { ProductCard } from '@/components/product-card';

const STOREFRONT_CURRENCY = process.env.STOREFRONT_CURRENCY ?? 'EUR';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: 'Category not found' };
  const name = resolveLocalized(cat.name, locale);
  return { title: name, description: `${name} — ClaudeShop` };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const products = await listCategoryProducts(slug, {
    limit: 48,
    priceFor: STOREFRONT_CURRENCY,
  });
  const name = resolveLocalized(cat.name, locale);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <nav className="text-xs text-muted-foreground">
        <Link href={`/${locale}`} className="hover:underline">
          Home
        </Link>
        <span className="mx-2">·</span>
        <Link href={`/${locale}/products`} className="hover:underline">
          All products
        </Link>
        <span className="mx-2">·</span>
        <span>{name}</span>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Category
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? '' : 's'}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          No products in this category yet.
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
