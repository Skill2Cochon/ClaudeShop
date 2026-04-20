import { z } from 'zod';

/**
 * Per-tenant settings for the Stripe module. Persisted in
 * `ModuleInstallation.settings` as encrypted JSON (envelope encryption with
 * a tenant-scoped DEK).
 */
export const StripeModuleSettingsSchema = z.object({
  mode: z.enum(['test', 'live']).default('test'),
  /** `sk_test_...` / `sk_live_...`. Read-only at runtime; rotated via admin UI. */
  secretKey: z.string().regex(/^sk_(test|live)_/, 'Expected Stripe secret key'),
  /** `whsec_...` — required to verify webhook signatures. */
  webhookSecret: z.string().regex(/^whsec_/, 'Expected Stripe webhook secret'),
  /** `pk_test_...` / `pk_live_...` — safe to expose on the storefront. */
  publishableKey: z.string().regex(/^pk_(test|live)_/, 'Expected Stripe publishable key'),
  /** Stripe account id to use for connected accounts. Optional. */
  accountId: z.string().startsWith('acct_').optional(),
  /** Automatic payment methods preset (default: Stripe-recommended). */
  automaticPaymentMethods: z.boolean().default(true),
});

export type StripeModuleSettings = z.infer<typeof StripeModuleSettingsSchema>;
