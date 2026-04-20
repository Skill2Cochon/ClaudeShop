import Link from 'next/link';
import type { Product } from '@claudeshop/contracts/product';
import { formatPrice, resolveLocalized, type Locale } from '@/lib/i18n';

interface ProductCardProps {
  product: Product;
  locale: Locale;
  fallbackCurrency?: string;
}

export function ProductCard({ product, locale, fallbackCurrency = 'EUR' }: ProductCardProps) {
  const name = resolveLocalized(product.name, locale);
  const description = product.description
    ? resolveLocalized(product.description, locale)
    : '';

  const priced = product.variants
    .map((v) => (v.price ? Number.parseFloat(v.price.amount) : null))
    .filter((n): n is number => n !== null && !Number.isNaN(n));
  const cheapest = priced.length > 0 ? Math.min(...priced) : null;
  const currency =
    product.variants.find((v) => v.price)?.price?.currency ?? fallbackCurrency;

  return (
    <Link
      href={`/${locale}/p/${encodeURIComponent(product.slug)}`}
      className="flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <p className="truncate text-sm font-semibold">{name}</p>
      {description ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 flex items-end justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">{product.slug}</span>
        {cheapest !== null ? (
          <span className="text-sm font-semibold">
            {priced.length > 1 ? 'from ' : ''}
            {formatPrice(cheapest, currency, locale)}
          </span>
        ) : (
          <span className="text-[10px] italic text-muted-foreground">No price</span>
        )}
      </div>
    </Link>
  );
}
