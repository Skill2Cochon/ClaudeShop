const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Phase 60 — same fallback chain as src/lib/api.ts. Kept inline (rather
// than imported) because importing crosses the "lib" boundary twice and
// Next.js already bundles per-file; the 6-line duplication is not worth
// the import churn.
const TENANT_ID_ENV =
  process.env.STOREFRONT_TENANT_ID ?? process.env.SEEDED_DEMO_TENANT_ID ?? '';
const TENANT_SLUG_ENV =
  process.env.STOREFRONT_TENANT_SLUG ?? process.env.SEEDED_DEMO_TENANT_SLUG ?? 'demo';
function tenantHeaders(): Record<string, string> {
  if (TENANT_ID_ENV && TENANT_ID_ENV.length >= 8) {
    return { 'x-tenant-id': TENANT_ID_ENV };
  }
  return { 'x-tenant-slug': TENANT_SLUG_ENV };
}

export interface SiteBrand {
  name: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface SiteStorefrontCopy {
  heroHeadline?: string;
  heroTagline?: string;
  supportEmail?: string;
  publicUrl?: string;
}

export interface Site {
  currency: string;
  defaultLocale: string;
  locales: string[];
  brand: SiteBrand;
  storefront?: SiteStorefrontCopy;
}

const DEFAULT_SITE: Site = {
  currency: 'EUR',
  defaultLocale: 'en',
  locales: ['en', 'fr', 'de', 'es'],
  brand: { name: 'ClaudeShop' },
};

/**
 * Fetch the public site settings for the current tenant. Cached at the
 * Next.js data layer for 60 seconds + tagged by path so the admin can
 * trigger revalidation when it saves. Falls back to the default shape if
 * the API is unreachable so the storefront never renders a blank page.
 */
export async function getSite(): Promise<Site> {
  try {
    const res = await fetch(`${API_URL}/v1/site`, {
      headers: {
        accept: 'application/json',
        ...tenantHeaders(),
      },
      next: { revalidate: 60, tags: ['site'] },
    });
    if (!res.ok) return DEFAULT_SITE;
    const body = (await res.json()) as { data: Site };
    return body.data;
  } catch {
    return DEFAULT_SITE;
  }
}
