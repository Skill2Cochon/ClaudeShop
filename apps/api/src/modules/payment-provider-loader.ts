import type { PaymentProvider } from '@claudeshop/core';
import { StubPaymentProvider } from '../adapters/stub-payment-provider.js';

export interface PaymentProviderEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
}

/**
 * Phase 3.0 transitional loader.
 *
 * When STRIPE_* env vars are configured, loads the `@claudeshop/module-
 * payment-stripe` module dynamically and returns its provider. Otherwise
 * falls back to StubPaymentProvider (dev).
 *
 * Phase 3.1+ replaces this with a real ModuleRegistry that:
 *   - discovers modules from `ModuleInstallation` rows in the DB
 *   - calls lifecycle hooks in order
 *   - honours the capability manifest (permissions + isolation tier)
 */
export async function resolvePaymentProvider(
  env: PaymentProviderEnv,
): Promise<PaymentProvider> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_PUBLISHABLE_KEY) {
    return new StubPaymentProvider();
  }

  try {
    // Dynamic import keeps the `stripe` dep optional at install time for
    // deployments that don't use payments (yet).
    const mod = await import('@claudeshop/module-payment-stripe');
    return mod.createStripeProvider({
      mode: env.NODE_ENV === 'production' ? 'live' : 'test',
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      automaticPaymentMethods: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load @claudeshop/module-payment-stripe (${message}). ` +
        'Either install the module or unset STRIPE_* env vars to use the stub provider.',
    );
  }
}
