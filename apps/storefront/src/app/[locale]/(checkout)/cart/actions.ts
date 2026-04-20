'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addToCart as apiAddToCart,
  removeCartItem as apiRemoveItem,
  updateCartItem as apiUpdateItem,
  placeOrder as apiPlaceOrder,
} from '@/lib/api';
import {
  deletePromotionCodeCookie,
  readPromotionCodeCookie,
} from './promotion-actions';

const CART_COOKIE = 'claudeshop_cart_id';
const ANON_COOKIE = 'claudeshop_anon_id';

function randomAnonId(): string {
  return `anon-${Math.random().toString(36).slice(2, 14)}`;
}

async function readCookies(): Promise<{ cartId: string | undefined; anonymousId: string }> {
  const jar = await cookies();
  const cartId = jar.get(CART_COOKIE)?.value;
  let anonymousId = jar.get(ANON_COOKIE)?.value;
  if (!anonymousId) anonymousId = randomAnonId();
  return { cartId, anonymousId };
}

async function writeAnonCookie(value: string): Promise<void> {
  const jar = await cookies();
  if (!jar.get(ANON_COOKIE)) {
    jar.set(ANON_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

async function writeCartCookie(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(CART_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function addToCartAction(variantId: string, qty: number): Promise<void> {
  const { cartId, anonymousId } = await readCookies();
  const cart = cartId
    ? await apiAddToCart({ cartId, variantId, qty })
    : await apiAddToCart({ anonymousId, variantId, qty });

  await writeAnonCookie(anonymousId);
  await writeCartCookie(cart.id);
  revalidatePath('/[locale]/cart', 'page');
}

export async function updateCartItemAction(itemId: string, qty: number): Promise<void> {
  const { cartId } = await readCookies();
  if (!cartId) return;
  await apiUpdateItem(itemId, { cartId, qty });
  revalidatePath('/[locale]/cart', 'page');
}

export async function removeCartItemAction(itemId: string): Promise<void> {
  const { cartId } = await readCookies();
  if (!cartId) return;
  await apiRemoveItem(cartId, itemId);
  revalidatePath('/[locale]/cart', 'page');
}

export async function placeOrderAction(
  customerEmail: string | undefined,
): Promise<{ orderId: string; number: string }> {
  const { cartId } = await readCookies();
  if (!cartId) throw new Error('No cart to checkout');
  const promotionCode = await readPromotionCodeCookie();
  const order = await apiPlaceOrder({
    cartId,
    ...(customerEmail ? { customerEmail } : {}),
    ...(promotionCode ? { promotionCode } : {}),
  });
  const jar = await cookies();
  jar.delete(CART_COOKIE);
  await deletePromotionCodeCookie();
  revalidatePath('/[locale]/cart', 'page');
  return { orderId: order.id, number: order.number };
}

/**
 * Phase 35 guest checkout — stricter than placeOrderAction above:
 *   - email is REQUIRED (guest receipts, order tracking, soft spam)
 *   - first/last name required for the future shipping label
 *   - country required; region/postcode optional unless tax needs them
 *   - everything parsed through Zod so a malformed payload never
 *     reaches the API layer
 *
 * Returned shape is discriminated so the checkout page can render
 * inline field errors without throwing from the server action (Next's
 * default error boundary is too heavy for form validation).
 */
const GuestCheckoutSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
  firstName: z.string().min(1, 'First name is required.').max(80),
  lastName: z.string().min(1, 'Last name is required.').max(80),
  company: z.string().max(120).optional(),
  line1: z.string().min(1, 'Street address is required.').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required.').max(120),
  region: z.string().max(20).optional(),
  postcode: z.string().min(1, 'Postcode is required.').max(40),
  country: z
    .string()
    .length(2, 'Use a two-letter country code (ISO 3166-1).')
    .regex(/^[A-Z]{2}$/, 'Country must be two uppercase letters.'),
  phone: z.string().max(40).optional(),
});

export type PlaceGuestOrderResult =
  | { ok: true; orderId: string; number: string }
  | { ok: false; errors: Record<string, string> };

function optionalTrimmed(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredTrimmed(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function placeGuestOrderAction(
  _prev: PlaceGuestOrderResult | undefined,
  formData: FormData,
): Promise<PlaceGuestOrderResult> {
  const candidate = {
    email: requiredTrimmed(formData.get('email')),
    firstName: requiredTrimmed(formData.get('firstName')),
    lastName: requiredTrimmed(formData.get('lastName')),
    company: optionalTrimmed(formData.get('company')),
    line1: requiredTrimmed(formData.get('line1')),
    line2: optionalTrimmed(formData.get('line2')),
    city: requiredTrimmed(formData.get('city')),
    region: optionalTrimmed(formData.get('region')),
    postcode: requiredTrimmed(formData.get('postcode')),
    country: requiredTrimmed(formData.get('country')).toUpperCase(),
    phone: optionalTrimmed(formData.get('phone')),
  };

  const parsed = GuestCheckoutSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !errors[key]) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  const { cartId } = await readCookies();
  if (!cartId) {
    return { ok: false, errors: { _form: 'Your cart expired — add items again.' } };
  }

  try {
    const promotionCode = await readPromotionCodeCookie();
    const order = await apiPlaceOrder({
      cartId,
      customerEmail: parsed.data.email,
      shippingAddress: {
        country: parsed.data.country,
        ...(parsed.data.region ? { region: parsed.data.region } : {}),
        postcode: parsed.data.postcode,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        ...(parsed.data.company ? { company: parsed.data.company } : {}),
        line1: parsed.data.line1,
        ...(parsed.data.line2 ? { line2: parsed.data.line2 } : {}),
        city: parsed.data.city,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      },
      ...(promotionCode ? { promotionCode } : {}),
    });
    const jar = await cookies();
    jar.delete(CART_COOKIE);
    await deletePromotionCodeCookie();
    revalidatePath('/[locale]/cart', 'page');
    return { ok: true, orderId: order.id, number: order.number };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not place order.';
    return { ok: false, errors: { _form: message } };
  }
}
