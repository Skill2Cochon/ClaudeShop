import { defineModule } from '@claudeshop/module-kit';
import manifest from '../claudeshop.json' with { type: 'json' };
import { StripePaymentProvider } from './provider';
import { StripeModuleSettingsSchema, type StripeModuleSettings } from './settings';

/**
 * Module entry point. The runtime calls `defineModule` at startup, then
 * invokes the lifecycle hooks. Providers are attached to the runtime
 * context via `onActivate`.
 *
 * Phase 3 runtime wires a `ModuleContext` that exposes:
 *   ctx.registerPaymentProvider(provider)
 *   ctx.settings // validated against settingsSchema
 *   ctx.logger
 *   ctx.events
 */
export default defineModule({
  manifest: {
    ...manifest,
    trust: manifest.trust as 'first-party' | 'verified' | 'community',
    isolation: manifest.isolation as 'in-process' | 'worker' | 'sandbox',
  },
  lifecycle: {
    async onActivate(ctx) {
      // Phase 3 runtime will expose ctx.settings as validated JSON. Here we
      // do the Zod parse ourselves as a defence-in-depth check.
      const settings = StripeModuleSettingsSchema.parse(ctx.settings);
      ctx.logger.info(
        { module: manifest.id, mode: settings.mode },
        'Stripe module activating — loaded keys from secret manager',
      );
      // The runtime picks up the provider via its registry (Phase 3).
      // For Phase 3.0 scaffolding we export the factory below.
    },
    async onDeactivate(ctx) {
      ctx.logger.info({ module: manifest.id }, 'Stripe module deactivated');
    },
  },
});

/**
 * Direct factory — used by the Phase 3.0 transitional loader in apps/api
 * while the full module runtime is not yet implemented. Future releases
 * will drop this export in favour of pure lifecycle-based wiring.
 */
export function createStripeProvider(settings: StripeModuleSettings): StripePaymentProvider {
  const parsed = StripeModuleSettingsSchema.parse(settings);
  return new StripePaymentProvider(parsed);
}

export { StripePaymentProvider } from './provider';
export { StripeModuleSettingsSchema, type StripeModuleSettings } from './settings';
