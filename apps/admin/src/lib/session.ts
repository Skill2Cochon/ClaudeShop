import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { Session } from '@claudeshop/contracts/auth';

/**
 * Admin app session, persisted in a signed + encrypted cookie via iron-session.
 * Next.js server actions + server components read/write the cookie directly
 * through cookies() from next/headers.
 */
export interface AdminSessionData {
  session?: Session;
}

const COOKIE_NAME = 'claudeshop_admin_session';

// Dev fallback — generated with `openssl rand -base64 32`. Production MUST set
// ADMIN_SESSION_SECRET (>= 32 chars) in the environment; the login server
// action refuses to sign a cookie when the secret matches this placeholder.
const DEV_SECRET = 'dev-only-admin-session-secret-change-in-production-_';

export const ADMIN_DEV_SESSION_SECRET = DEV_SECRET;

export function getSessionOptions(): SessionOptions {
  const password = process.env.ADMIN_SESSION_SECRET ?? DEV_SECRET;
  return {
    cookieName: COOKIE_NAME,
    password,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // 7 days. The session also carries its own issuedAt so we can enforce
      // re-login policies without trusting the cookie expiry alone.
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  return getIronSession<AdminSessionData>(await cookies(), getSessionOptions());
}

export async function getCurrentSession(): Promise<Session | null> {
  const store = await getAdminSession();
  return store.session ?? null;
}

export async function requireCurrentSession(): Promise<Session> {
  const session = await getCurrentSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}
