import { NextResponse, type NextRequest } from 'next/server';
import { adminFetch } from '@/lib/server-fetch';

export const dynamic = 'force-dynamic';

/**
 * Phase 38 — thin Next proxy in front of the API's CSV export. The
 * merchant clicks an `<a href="/api/orders/export?filters…">`; we
 * forward the querystring to the API with the session-resolved
 * `x-tenant-id` header attached, then stream the text/csv response
 * straight back to the browser. Running through Next lets the admin
 * UI stay oblivious to the API's auth headers.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const apiPath = `/v1/admin/orders/export.csv?${searchParams.toString()}`;

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

  // Preserve the disposition + content-type the API set, so the
  // browser's "Save as…" dialog shows `orders-YYYY-MM-DD.csv`.
  const headers = new Headers();
  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8',
  );
  headers.set(
    'content-disposition',
    upstream.headers.get('content-disposition') ??
      'attachment; filename="orders.csv"',
  );

  const text = await upstream.text();
  return new Response(text, { status: 200, headers });
}
