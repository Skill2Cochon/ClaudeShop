import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@claudeshop/ui';
import { getCart } from '@/lib/api';
import { isLocale, formatPrice } from '@/lib/i18n';
import { removeCartItemAction, updateCartItemAction } from './actions';
import { PromotionForm } from './promotion-form';

export const metadata: Metadata = {
  title: 'Cart',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  const cookieLocale = isLocale(locale) ? locale : 'en';

  const jar = await cookies();
  const cartId = jar.get('claudeshop_cart_id')?.value;
  const cart = cartId ? await getCart(cartId) : null;

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          [{cookieLocale}] · Cart
        </p>
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">Find something you love on the storefront.</p>
        <Link href={`/${cookieLocale}`}>
          <Button size="lg">Browse products</Button>
        </Link>
      </main>
    );
  }

  const subtotalCents = cart.items.reduce(
    (sum, item) => sum + Math.round(Number.parseFloat(item.unitPrice) * 100) * item.qty,
    0,
  );

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          [{cookieLocale}] · Cart · {cart.currency}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Review your cart</h1>
        <p className="text-sm text-muted-foreground">
          {cart.items.length} {cart.items.length > 1 ? 'items' : 'item'} · cart id:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{cart.id}</code>
        </p>
      </header>

      <section className="divide-y rounded-lg border bg-card">
        {cart.items.map((item) => {
          const lineTotal = Number.parseFloat(item.unitPrice) * item.qty;
          return (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-mono text-sm">{item.variantId}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(item.unitPrice, cart.currency, cookieLocale)} × {item.qty}
                </p>
              </div>

              <form action={updateCartItemAction.bind(null, item.id, item.qty - 1)}>
                <Button type="submit" size="sm" variant="outline" disabled={item.qty <= 1}>
                  −
                </Button>
              </form>
              <span className="w-8 text-center font-semibold">{item.qty}</span>
              <form action={updateCartItemAction.bind(null, item.id, item.qty + 1)}>
                <Button type="submit" size="sm" variant="outline">
                  +
                </Button>
              </form>

              <div className="w-24 text-right text-sm font-medium">
                {formatPrice(lineTotal, cart.currency, cookieLocale)}
              </div>

              <form action={removeCartItemAction.bind(null, item.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  Remove
                </Button>
              </form>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span>{formatPrice(subtotalCents / 100, cart.currency, cookieLocale)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Taxes & shipping calculated at checkout (Phase 2.3).
        </p>

        <div className="mt-4">
          <PromotionForm
            subtotal={(subtotalCents / 100).toFixed(2)}
            currency={cart.currency}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/${cookieLocale}/checkout`} className="block">
            <Button size="lg" className="w-full">
              Continue to checkout →
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll ask for your email + delivery address on the next step.
          </p>
        </div>
      </section>

      <footer className="text-center text-xs text-muted-foreground">
        <Link href={`/${cookieLocale}`} className="hover:underline">
          ← Continue shopping
        </Link>
      </footer>
    </main>
  );
}
