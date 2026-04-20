import { NextResponse, type NextRequest } from 'next/server';
import { adminFetch } from '@/lib/server-fetch';

export const dynamic = 'force-dynamic';

/**
 * Phase 39 — thin Next proxy for the API customers-export endpoint.
 * Mirrors /api/orders/export: forwards the querystring with the
 * session-resolved x-tenant-id, relays text/csv + Content-Disposition
 * back to the browser so the Save-as dialog gets the right filename.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const apiPath = `/v1/admin/customers/export.csv?${searchParams.toString()}`;

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
      'attachment; filename="customers.csv"',
  );

  const text = await upstream.text();
  return new Response(text, { status: 200, headers });
}
