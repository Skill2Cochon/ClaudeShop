import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@claudeshop/ui';
import {
  getProductBySlug,
  getProductReviews,
  getRelatedProducts,
  listWishlist,
  type SearchProductHit,
} from '@/lib/api';
import { isLocale, resolveLocalized, formatPrice, type Locale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { addToCartAction } from '../../../(checkout)/cart/actions';
import { ReviewForm } from './review-form';
import { HeartButton } from '@/components/wishlist/heart-button';

const STOREFRONT_CURRENCY = process.env.STOREFRONT_CURRENCY ?? 'EUR';

function stars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Not found' };
  const title = resolveLocalized(product.name, locale);
  const description = product.description ? resolveLocalized(product.description, locale) : '';
  return {
    title,
    description: description.slice(0, 200),
    openGraph: { title, description: description.slice(0, 200) },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getProductBySlug(slug, { priceFor: STOREFRONT_CURRENCY });
  if (!product) notFound();

  const name = resolveLocalized(product.name, locale);
  const description = product.description ? resolveLocalized(product.description, locale) : '';
  const [related, reviews, customer] = await Promise.all([
    getRelatedProducts(product.id, { limit: 4 }).catch(() => [] as SearchProductHit[]),
    getProductReviews(slug, { limit: 10 }),
    getCurrentCustomer(),
  ]);

  // Only list the wishlist once, after we know the customer, then derive
  // the flag for this product. `listWishlist` is cheap (indexed lookup),
  // and one call today lets us render heart state on "related" tiles too
  // later without a second round-trip.
  const wishlist = customer
    ? await listWishlist(customer.userId).catch(() => [] as { productId: string }[])
    : null;
  const isFavourited = wishlist
    ? wishlist.some((w) => w.productId === product.id)
    : null;

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <nav className="text-xs text-muted-foreground">
        <Link href={`/${locale}`} className="hover:underline">
          Home
        </Link>
        <span className="mx-2">·</span>
        <span>{product.slug}</span>
      </nav>

      <header className="space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {product.type.toLowerCase()}
        </span>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-balance text-4xl font-bold tracking-tight">{name}</h1>
          <HeartButton
            productId={product.id}
            locale={locale}
            initialFavourited={isFavourited}
          />
        </div>
        {(() => {
          const priced = product.variants
            .map((v) => (v.price ? Number.parseFloat(v.price.amount) : null))
            .filter((n): n is number => n !== null && !Number.isNaN(n));
          if (priced.length === 0) return null;
          const cheapest = Math.min(...priced);
          const currency = product.variants.find((v) => v.price)?.price?.currency ?? STOREFRONT_CURRENCY;
          return (
            <p className="text-2xl font-semibold">
              From {formatPrice(cheapest, currency, locale)}
            </p>
          );
        })()}
        {description ? (
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Variants
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.variants.map((v) => (
            <li key={v.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-sm">{v.sku}</p>
                {v.price ? (
                  <p className="text-base font-semibold">
                    {formatPrice(v.price.amount, v.price.currency, locale)}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground">No price</p>
                )}
              </div>
              {Object.keys(v.options).length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {Object.entries(v.options)
                    .map(([k, val]) => `${k}: ${val}`)
                    .join(' · ')}
                </p>
              ) : null}
              {v.barcode ? (
                <p className="mt-1 text-xs text-muted-foreground">barcode: {v.barcode}</p>
              ) : null}
              <form
                action={addToCartAction.bind(null, v.id, 1)}
                className="mt-3"
              >
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={!v.price}
                >
                  {v.price ? 'Add to cart' : 'Unavailable'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <Link href={`/${locale}/cart`}>
          <Button size="lg" variant="outline">
            View cart
          </Button>
        </Link>
      </div>

      <ReviewsSection
        productId={product.id}
        slug={slug}
        locale={locale}
        signedIn={Boolean(customer)}
        reviews={reviews?.data ?? []}
        summary={reviews?.meta.summary}
      />

      {related.length > 0 ? (
        <RelatedRail hits={related} locale={locale} />
      ) : null}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Status: <code className="rounded bg-muted px-1.5 py-0.5">{product.status}</code> ·{' '}
        Product id: <code className="rounded bg-muted px-1.5 py-0.5">{product.id}</code>
      </footer>
    </main>
  );
}

function RelatedRail({ hits, locale }: { hits: SearchProductHit[]; locale: Locale }) {
  return (
    <section className="space-y-3 border-t pt-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">You might also like</h2>
        <span className="text-xs text-muted-foreground">
          Picked by similarity · {hits.length} result{hits.length === 1 ? '' : 's'}
        </span>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hits.map((h) => {
          const name = resolveLocalized(h.name, locale);
          return (
            <li key={h.productId}>
              <Link
                href={`/${locale}/p/${encodeURIComponent(h.slug)}`}
                className="block rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
              >
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {h.slug}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  similarity {h.similarity.toFixed(3)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface ReviewsSectionProps {
  productId: string;
  slug: string;
  locale: string;
  signedIn: boolean;
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    authorName: string;
    createdAt: string;
  }>;
  summary?: {
    count: number;
    averageRating: number;
    histogram: Record<string, number>;
  };
}

function ReviewsSection({
  productId,
  slug,
  locale,
  signedIn,
  reviews,
  summary,
}: ReviewsSectionProps) {
  return (
    <section className="space-y-4 border-t pt-6">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Customer reviews</h2>
        {summary && summary.count > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{stars(summary.averageRating)}</span>{' '}
            {summary.averageRating.toFixed(1)} · {summary.count} review
            {summary.count === 1 ? '' : 's'}
          </p>
        ) : null}
      </header>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet — be the first to leave one.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border bg-card p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {r.title ?? `${stars(r.rating)} review`}
                </p>
                <span className="text-xs text-muted-foreground">{stars(r.rating)}</span>
              </div>
              {r.body ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {r.body}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Leave a review</h3>
        <ReviewForm
          productId={productId}
          locale={locale}
          slug={slug}
          signedIn={signedIn}
        />
      </div>
    </section>
  );
}
