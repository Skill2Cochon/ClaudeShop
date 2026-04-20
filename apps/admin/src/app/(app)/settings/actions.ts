'use server';

import { revalidatePath } from 'next/cache';
import type { TenantSettingsPatch } from '@claudeshop/contracts/tenant-settings';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error?.message ?? fallback;
}

function parseLocales(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function optional(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const currency = (formData.get('currency') ?? '').toString().trim().toUpperCase();
  const defaultLocale = (formData.get('defaultLocale') ?? '').toString().trim();
  const localesRaw = (formData.get('locales') ?? '').toString();
  const locales = parseLocales(localesRaw);

  const brandName = (formData.get('brand.name') ?? '').toString().trim();
  const brandTagline = optional(formData.get('brand.tagline'));
  const brandLogoUrl = optional(formData.get('brand.logoUrl'));
  const brandPrimaryColor = optional(formData.get('brand.primaryColor'));

  const heroHeadline = optional(formData.get('storefront.heroHeadline'));
  const heroTagline = optional(formData.get('storefront.heroTagline'));
  const supportEmail = optional(formData.get('storefront.supportEmail'));
  const publicUrl = optional(formData.get('storefront.publicUrl'));

  const patch: TenantSettingsPatch = {
    ...(currency.length === 3 ? { currency } : {}),
    ...(defaultLocale.length > 0 ? { defaultLocale } : {}),
    ...(locales.length > 0 ? { locales } : {}),
    brand: {
      ...(brandName.length > 0 ? { name: brandName } : {}),
      ...(brandTagline !== undefined ? { tagline: brandTagline } : {}),
      ...(brandLogoUrl !== undefined ? { logoUrl: brandLogoUrl } : {}),
      ...(brandPrimaryColor !== undefined ? { primaryColor: brandPrimaryColor } : {}),
    },
    storefront:
      heroHeadline !== undefined ||
      heroTagline !== undefined ||
      supportEmail !== undefined ||
      publicUrl !== undefined
        ? {
            ...(heroHeadline !== undefined ? { heroHeadline } : {}),
            ...(heroTagline !== undefined ? { heroTagline } : {}),
            ...(supportEmail !== undefined ? { supportEmail } : {}),
            ...(publicUrl !== undefined ? { publicUrl } : {}),
          }
        : undefined,
  };

  const res = await adminFetch('/v1/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    throw new Error(await readError(res, `Update failed (${res.status})`));
  }

  revalidatePath('/settings');
  // Storefront caches /v1/site with a 60s TTL, so new brand/locales/currency
  // surface within a minute. Phase 24.1 can add cross-app tag invalidation
  // once Next 16's revalidateTag signature stabilises.
}
