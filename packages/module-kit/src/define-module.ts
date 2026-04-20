import { ModuleManifestSchema, type ModuleManifest } from './manifest.js';
import type { ModuleLifecycle } from './lifecycle.js';

export interface ModuleDefinition {
  manifest: ModuleManifest;
  lifecycle?: ModuleLifecycle;
}

/**
 * Helper for module authors — validates the manifest at definition time,
 * providing rich error messages in the dev loop rather than at registration.
 *
 * @example
 *   export default defineModule({
 *     manifest: {
 *       id: '@claudeshop/payment-stripe',
 *       name: 'Stripe Payments',
 *       version: '1.0.0',
 *       api: { min: '1.0.0', max: '2.0.0' },
 *       trust: 'first-party',
 *       isolation: 'in-process',
 *       permissions: ['order:read', 'payment:write', 'http:outbound:api.stripe.com'],
 *     },
 *     lifecycle: {
 *       async onActivate(ctx) { ... },
 *     },
 *   });
 */
export function defineModule(def: ModuleDefinition): ModuleDefinition {
  const manifest = ModuleManifestSchema.parse(def.manifest);
  return { manifest, lifecycle: def.lifecycle };
}
