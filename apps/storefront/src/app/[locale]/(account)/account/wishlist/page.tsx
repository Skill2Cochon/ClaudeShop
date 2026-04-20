import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale, resolveLocalized } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { listWishlist } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wishlist' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function WishlistPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const entries = await listWishlist(session.userId);
  // Drop entries whose product disappeared (archived / deleted). Active-only
  // keeps the page honest — Phase 27.1 could show a strike-through instead.
  const visible = entries.filter((e) => e.product && e.product.status !== 'ARCHIVED');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Saved products</h1>
        <p className="text-sm text-muted-foreground">
          {visible.length} saved product{visible.length === 1 ? '' : 's'}. Tap any card to
          revisit; the heart on the product page toggles it off.
        </p>
      </header>

      {visible.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          Nothing saved yet. Tap the heart on a product page to save it for later.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((entry) => {
            const product = entry.product;
            if (!product) return null;
            const name = resolveLocalized(product.name, locale);
            return (
              <li key={entry.productId}>
                <Link
                  href={`/${locale}/p/${encodeURIComponent(product.slug)}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        product.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {product.slug}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Saved {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
