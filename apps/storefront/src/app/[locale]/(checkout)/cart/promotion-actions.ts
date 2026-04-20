'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { applyPromotionCode, type AppliedPromotionResult } from '@/lib/api';

/**
 * Phase 53 — cookie that carries the validated promotion code from the
 * cart preview all the way to the place-order action. A single source
 * of truth per session: when the code is cleared, the checkout form
 * reads an empty value and drops the chip.
 */
const PROMO_COOKIE = 'claudeshop_promo_code';

export type ApplyPromotionState =
  | { status: 'idle' }
  | { status: 'ok'; applied: AppliedPromotionResult }
  | { status: 'error'; message: string };

interface ApiError {
  error?: { message?: string };
}

export async function applyPromotionCodeAction(
  payload: { subtotal: string; currency: string },
  _prev: ApplyPromotionState,
  formData: FormData,
): Promise<ApplyPromotionState> {
  const code = (formData.get('code') ?? '').toString().trim().toUpperCase();
  if (code.length === 0) {
    return { status: 'error', message: 'Enter a promotion code.' };
  }

  try {
    const applied = await applyPromotionCode({
      code,
      subtotal: payload.subtotal,
      currency: payload.currency,
    });
    if (!applied) {
      return { status: 'error', message: 'That code is not valid.' };
    }
    // Stash the validated code so the checkout step picks it up and
    // forwards it to placeOrder. Same TTL as the cart cookie so they
    // expire together.
    const jar = await cookies();
    jar.set(PROMO_COOKIE, applied.code, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return { status: 'ok', applied };
  } catch (err) {
    if (err instanceof Error) {
      // apiFetch throws with the API error message preserved in the Error.
      return { status: 'error', message: err.message };
    }
    // Preserve ApiError envelope where present.
    const body = err as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? 'Could not apply the code.',
    };
  }
}

/** Phase 53 — remove the promo cookie so the next place-order submits clean. */
export async function clearPromotionCodeAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(PROMO_COOKIE);
  revalidatePath('/[locale]/cart', 'page');
  revalidatePath('/[locale]/checkout', 'page');
}

/** Read-only helper used by the checkout page + place-order action. */
export async function readPromotionCodeCookie(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(PROMO_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

/** Called by placeGuestOrderAction post-success so the next order runs clean. */
export async function deletePromotionCodeCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PROMO_COOKIE);
}
