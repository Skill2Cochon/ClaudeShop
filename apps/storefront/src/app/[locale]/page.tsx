import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listCategories, listProducts } from '@/lib/api';
import { isLocale, resolveLocalized, type Locale } from '@/lib/i18n';
import { ProductCard } from '@/components/product-card';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';

const HOME_COPY: Record<Locale, { heading: string; tagline: string; browse: string; categories: string }> = {
  en: {
    heading: 'Welcome',
    tagline: 'Headless commerce, re-imagined for 2026.',
    browse: 'Browse all products',
    categories: 'Shop by category',
  },
  fr: {
    heading: 'Bienvenue',
    tagline: 'Le commerce headless, réinventé pour 2026.',
    browse: 'Voir tous les produits',
    categories: 'Parcourir par catégorie',
  },
  de: {
    heading: 'Willkommen',
    tagline: 'Headless Commerce, neu gedacht für 2026.',
    browse: 'Alle Produkte anzeigen',
    categories: 'Nach Kategorie kaufen',
  },
  es: {
    heading: 'Bienvenido',
    tagline: 'Commerce headless, reinventado para 2026.',
    browse: 'Ver todos los productos',
    categories: 'Comprar por categoría',
  },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocalizedHome({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const fallback = HOME_COPY[locale];

  const site = await getSite();
  const heading = site.storefront?.heroHeadline ?? fallback.heading;
  const tagline = site.storefront?.heroTagline ?? site.brand.tagline ?? fallback.tagline;

  const [featured, categories] = await Promise.all([
    listProducts({ limit: 8, priceFor: site.currency }),
    listCategories({ rootOnly: true }),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-12 p-8">
      <section className="space-y-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          [{locale}] · {site.brand.name}
        </p>
        <h1 className="text-balance text-5xl font-bold tracking-tight">{heading}</h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-muted-foreground">
          {tagline}
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href={`/${locale}/products`}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            {fallback.browse}
          </Link>
        </div>
      </section>

      {categories.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {fallback.categories}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const name = resolveLocalized(c.name, locale);
              return (
                <li key={c.id}>
                  <Link
                    href={`/${locale}/c/${encodeURIComponent(c.slug)}`}
                    className="rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-foreground/20"
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Featured
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export function generateStaticParams() {
  return (['en', 'fr', 'de', 'es'] as const).map((locale) => ({ locale }));
}
