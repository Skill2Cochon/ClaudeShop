import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { CustomerAddress } from '@claudeshop/contracts/customer';
import { getCart, listAddresses } from '@/lib/api';
import { isLocale, formatPrice } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import {
  clearPromotionCodeAction,
  readPromotionCodeCookie,
} from '../cart/promotion-actions';
import { CheckoutForm } from './checkout-form';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Phase 35 — dedicated checkout step. The cart page is now review-
 * only and pushes into this page for contact + address capture. Both
 * routes live under the (checkout) group so they share the same
 * conversion-focused layout chrome and the Order page below it.
 */
export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  const cookieLocale = isLocale(locale) ? locale : 'en';

  const jar = await cookies();
  const cartId = jar.get('claudeshop_cart_id')?.value;
  const cart = cartId ? await getCart(cartId) : null;

  // Guard: an empty cart should never make it into checkout. Bounce
  // back to /cart where the "empty cart" message lives.
  if (!cart || cart.items.length === 0) {
    redirect(`/${cookieLocale}/cart`);
  }

  const subtotalCents = cart.items.reduce(
    (sum, item) => sum + Math.round(Number.parseFloat(item.unitPrice) * 100) * item.qty,
    0,
  );

  // Phase 50d — if the customer is signed in, prefill the form from
  // their default saved address (or the first one in the list).
  // Anonymous carts still get a blank form.
  const session = await getCurrentCustomer();
  let prefill: CustomerAddress | null = null;
  let sessionEmail: string | null = null;
  if (session) {
    sessionEmail = session.email;
    try {
      const saved = await listAddresses(session.email);
      prefill = saved.find((a) => a.isDefault) ?? saved[0] ?? null;
    } catch {
      // Best-effort prefill — a failure here shouldn't block checkout.
      prefill = null;
    }
  }

  // Phase 53 — surface the validated promo code from the cart step
  // with a "Remove" action in case the customer wants to drop it.
  const promoCode = await readPromotionCodeCookie();

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          [{cookieLocale}] · Checkout · {cart.currency}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Where should we ship this?
        </h1>
        <p className="text-sm text-muted-foreground">
          {session
            ? `Signed in as ${session.email}${prefill ? ` — prefilled from your ${prefill.isDefault ? 'default' : 'saved'} address.` : '.'}`
            : 'Guest checkout — no account required. You\u2019ll get the receipt and tracking on the email below.'}
        </p>
        {session ? (
          <Link
            href={`/${cookieLocale}/account/addresses`}
            className="inline-block text-xs text-muted-foreground hover:underline"
          >
            Manage saved addresses →
          </Link>
        ) : null}
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_340px]">
        <section>
          <CheckoutForm
            locale={cookieLocale}
            {...(prefill ? { prefill } : {})}
            {...(sessionEmail ? { sessionEmail } : {})}
          />
        </section>

        <aside className="h-fit space-y-4 rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <ul className="space-y-2 text-xs">
            {cart.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3"
              >
                <span className="flex-1">
                  <span className="block font-mono text-[11px]">
                    {item.variantId}
                  </span>
                  <span className="text-muted-foreground">qty {item.qty}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPrice(
                    Number.parseFloat(item.unitPrice) * item.qty,
                    cart.currency,
                    cookieLocale,
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Subtotal</span>
              <span>
                {formatPrice(subtotalCents / 100, cart.currency, cookieLocale)}
              </span>
            </div>
            {promoCode ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-900">
                <span>
                  Promo <span className="font-mono font-semibold">{promoCode}</span>{' '}
                  applied — discount confirmed on place-order.
                </span>
                <form action={clearPromotionCodeAction}>
                  <button
                    type="submit"
                    className="text-emerald-900/80 underline hover:text-emerald-900"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Taxes + shipping added once we know where you are.
            </p>
          </div>
          <Link
            href={`/${cookieLocale}/cart`}
            className="block text-center text-xs text-muted-foreground hover:underline"
          >
            ← Back to cart
          </Link>
        </aside>
      </div>
    </main>
  );
}
