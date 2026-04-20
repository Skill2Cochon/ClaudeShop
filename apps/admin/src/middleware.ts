import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight gate — every request to an authenticated page must carry the
 * iron-session cookie. The cookie is validated (decrypted + session shape
 * checked) in each (app) layout, so middleware just short-circuits the
 * obvious "no cookie at all" case to avoid rendering the layout.
 *
 * Public routes: /login, /api/*, static assets.
 */
const COOKIE_NAME = 'claudeshop_admin_session';

export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  const hasCookie = request.cookies.has(COOKIE_NAME);
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
