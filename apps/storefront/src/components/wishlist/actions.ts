'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentCustomer } from '@/lib/session';
import { toggleWishlist } from '@/lib/api';

/**
 * Toggle a product's wishlist state for the current customer.
 *
 * - Anonymous → returns `{ redirect: '/<locale>/login' }` so the client can
 *   bounce the user to sign-in without blowing up the Server Action.
 * - Signed-in → returns `{ favourited: boolean }` with the new state.
 */
export async function toggleWishlistAction(
  productId: string,
  locale: string,
): Promise<
  | { status: 'needs-auth'; loginHref: string }
  | { status: 'ok'; favourited: boolean }
> {
  const session = await getCurrentCustomer();
  if (!session) {
    return { status: 'needs-auth', loginHref: `/${locale}/login` };
  }

  const result = await toggleWishlist(session.userId, productId);
  revalidatePath(`/${locale}/account/wishlist`);
  return { status: 'ok', favourited: result.favourited };
}
