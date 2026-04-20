import { NextResponse, type NextRequest } from 'next/server';
import { adminFetch } from '@/lib/server-fetch';

export const dynamic = 'force-dynamic';

/**
 * Phase 55 — Next proxy for the CMS pages CSV export. Seventh in
 * the set; same shape as the other export proxies.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const apiPath = `/v1/admin/pages/export.csv?${searchParams.toString()}`;

  const upstream = await adminFetch(apiPath);

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    return NextResponse.json(
      {
        error: {
          code: 'EXPORT_FAILED',
          message: `Upstream ${upstream.status}: ${body.slice(0, 200)}`,
          status: upstream.status,
        },
      },
      { status: upstream.status },
    );
  }

  const headers = new Headers();
  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8',
  );
  headers.set(
    'content-disposition',
    upstream.headers.get('content-disposition') ??
      'attachment; filename="pages.csv"',
  );

  const text = await upstream.text();
  return new Response(text, { status: 200, headers });
}
