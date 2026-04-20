import { z } from 'zod';

/**
 * Module manifest schema — validated at registration time.
 * Modules ship a `claudeshop.json` (or export a default manifest) that matches this shape.
 */

export const ModuleTrustSchema = z.enum(['first-party', 'verified', 'community']);

export const ModuleIsolationSchema = z.enum(['in-process', 'worker', 'sandbox']);

/**
 * Capability-based permission strings. Examples:
 *   "order:read", "order:write"
 *   "payment:write"
 *   "http:outbound:api.stripe.com"
 *   "secret:read:stripe.*"
 */
export const ModulePermissionSchema = z
  .string()
  .regex(
    /^[a-z_]+:[a-z_*]+(?::[a-zA-Z0-9._*\-/]+)?$/,
    'Expected "<resource>:<action>[:<scope>]" (e.g. "order:read" or "http:outbound:api.stripe.com")',
  );

export const ModuleAdminExtensionSchema = z.object({
  slots: z.array(z.string().min(1)).default([]),
  entry: z.string().min(1),
});

export const ModuleExtensionsSchema = z.object({
  httpRoutes: z.string().optional(),
  graphql: z.string().optional(),
  events: z.string().optional(),
  admin: ModuleAdminExtensionSchema.optional(),
  storefront: ModuleAdminExtensionSchema.optional(),
  jobs: z.string().optional(),
  migrations: z.string().optional(),
  /** Path to a module exporting a PaymentProvider factory. */
  paymentProvider: z.string().optional(),
  /** Path to a module exporting a ShippingProvider factory (Phase 3.1). */
  shippingProvider: z.string().optional(),
});

export const ModuleManifestSchema = z.object({
  $schema: z.string().optional(),
  id: z
    .string()
    .regex(/^@[a-z0-9-]+\/[a-z0-9-]+$/, 'Expected "@<scope>/<name>" (e.g. "@claudeshop/payment-stripe")'),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/, 'Semver'),
  description: z.string().max(400).optional(),
  author: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  api: z
    .object({
      min: z.string(),
      max: z.string(),
    })
    .strict(),
  trust: ModuleTrustSchema.default('community'),
  isolation: ModuleIsolationSchema.default('worker'),
  permissions: z.array(ModulePermissionSchema).default([]),
  extensions: ModuleExtensionsSchema.default({}),
  settingsSchema: z.string().optional(),
  lifecycle: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
});

export type ModuleTrust = z.infer<typeof ModuleTrustSchema>;
export type ModuleIsolation = z.infer<typeof ModuleIsolationSchema>;
export type ModulePermission = z.infer<typeof ModulePermissionSchema>;
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
