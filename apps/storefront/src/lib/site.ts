const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const DEMO_TENANT_ID = process.env.STOREFRONT_TENANT_ID ?? 'demo';

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
        'x-tenant-id': DEMO_TENANT_ID,
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
