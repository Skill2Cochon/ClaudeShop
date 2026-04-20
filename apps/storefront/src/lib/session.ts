import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { Session } from '@claudeshop/contracts/auth';

/**
 * Storefront customer session — separate cookie from the admin app.
 * Stores the authenticated customer's identity so PDP / cart / account
 * can personalise the UI and auto-link orders to a real user.
 */
export interface StorefrontSessionData {
  session?: Session;
}

const COOKIE_NAME = 'claudeshop_customer_session';

const DEV_SECRET =
  'dev-only-customer-session-secret-change-in-production-____';

export function getSessionOptions(): SessionOptions {
  const password = process.env.STOREFRONT_SESSION_SECRET ?? DEV_SECRET;
  return {
    cookieName: COOKIE_NAME,
    password,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

export async function getCustomerSession(): Promise<IronSession<StorefrontSessionData>> {
  return getIronSession<StorefrontSessionData>(await cookies(), getSessionOptions());
}

export async function getCurrentCustomer(): Promise<Session | null> {
  const store = await getCustomerSession();
  return store.session ?? null;
}
