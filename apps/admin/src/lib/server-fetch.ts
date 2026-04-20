import { getCurrentSession } from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const FALLBACK_TENANT_ID = process.env.ADMIN_TENANT_ID ?? 'demo';

export async function tenantHeader(): Promise<string> {
  const session = await getCurrentSession();
  return session?.tenantId ?? FALLBACK_TENANT_ID;
}

export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const tenantId = await tenantHeader();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-tenant-id': tenantId,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}
