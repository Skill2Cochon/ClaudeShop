import { getCurrentSession } from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Phase 60 — tenant addressing fallback chain.
//   1. logged-in session's tenantId (CUID)                — preferred
//   2. ADMIN_TENANT_ID env var (explicit override)
//   3. SEEDED_DEMO_TENANT_ID env var (written by `pnpm db:seed`)
//   4. x-tenant-slug header using ADMIN_TENANT_SLUG / SEEDED_DEMO_TENANT_SLUG / 'demo'
//      — the API resolves this via a Prisma+LRU cache lookup.
const ADMIN_TENANT_ID_ENV =
  process.env.ADMIN_TENANT_ID ?? process.env.SEEDED_DEMO_TENANT_ID ?? '';
const ADMIN_TENANT_SLUG_ENV =
  process.env.ADMIN_TENANT_SLUG ?? process.env.SEEDED_DEMO_TENANT_SLUG ?? 'demo';

export async function tenantHeader(): Promise<string> {
  const session = await getCurrentSession();
  return session?.tenantId ?? ADMIN_TENANT_ID_ENV;
}

/**
 * Build the tenant-addressing headers. Prefers an explicit CUID when one
 * is known (zero-cost API side); otherwise ships the slug which the API
 * resolves with a cached DB lookup.
 */
export async function tenantAddressingHeaders(): Promise<Record<string, string>> {
  const id = await tenantHeader();
  if (id && id.length >= 8) {
    return { 'x-tenant-id': id };
  }
  return { 'x-tenant-slug': ADMIN_TENANT_SLUG_ENV };
}

export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const tenantHeaders = await tenantAddressingHeaders();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}
