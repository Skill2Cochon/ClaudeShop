import { z } from 'zod';

/**
 * Tenant-wide settings persisted on Tenant.settings (Json column).
 *
 * Everything here is merchant-editable via /v1/admin/settings. Fields are
 * deliberately non-sensitive (branding, locales, defaults) — secrets go in
 * the ModuleInstallation.settings envelope-encrypted blob, not here.
 */

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export const BrandSettingsSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(240).optional(),
  logoUrl: z.string().url().max(1024).optional(),
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'primaryColor must be a hex like #0ea5e9')
    .optional(),
});
export type BrandSettings = z.infer<typeof BrandSettingsSchema>;

export const StorefrontSettingsSchema = z.object({
  heroHeadline: z.string().max(200).optional(),
  heroTagline: z.string().max(400).optional(),
  supportEmail: z.string().email().optional(),
  /** Canonical origin for SEO + email links (no trailing slash). */
  publicUrl: z.string().url().optional(),
});
export type StorefrontSettings = z.infer<typeof StorefrontSettingsSchema>;

export const TenantSettingsSchema = z.object({
  currency: z.string().regex(CURRENCY_PATTERN, 'ISO-4217 3-letter code'),
  defaultLocale: z.string().regex(LOCALE_PATTERN, 'BCP-47-lite like "en" or "en-US"'),
  locales: z
    .array(z.string().regex(LOCALE_PATTERN))
    .min(1)
    .max(12),
  brand: BrandSettingsSchema,
  storefront: StorefrontSettingsSchema.optional(),
});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

/**
 * Patch shape — any subset is allowed. The repository merges it onto the
 * current settings and re-validates the full object so we never persist a
 * half-settings row that fails the schema.
 */
export const TenantSettingsPatchSchema = TenantSettingsSchema.partial().extend({
  brand: BrandSettingsSchema.partial().optional(),
  storefront: StorefrontSettingsSchema.partial().optional(),
});
export type TenantSettingsPatch = z.infer<typeof TenantSettingsPatchSchema>;

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  currency: 'EUR',
  defaultLocale: 'en',
  locales: ['en', 'fr', 'de', 'es'],
  brand: {
    name: 'ClaudeShop',
  },
};

/**
 * Merge a patch onto the current settings without losing nested keys. Used
 * by the repository before re-validation.
 */
export function mergeTenantSettings(
  current: TenantSettings,
  patch: TenantSettingsPatch,
): TenantSettings {
  return {
    currency: patch.currency ?? current.currency,
    defaultLocale: patch.defaultLocale ?? current.defaultLocale,
    locales: patch.locales ?? current.locales,
    brand: {
      ...current.brand,
      ...(patch.brand ?? {}),
    },
    storefront: patch.storefront
      ? {
          ...(current.storefront ?? {}),
          ...patch.storefront,
        }
      : current.storefront,
  };
}
