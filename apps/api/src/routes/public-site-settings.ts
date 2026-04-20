import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { TenantSettingsRepository } from '@claudeshop/core';

export interface PublicSiteSettingsRoutesDeps {
  settingsRepo: TenantSettingsRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Storefront-facing read endpoint for the public subset of tenant settings.
 * No PII / secrets — currency, locales, brand name / logo / primary color,
 * and storefront copy. Cached at the edge via cache headers in Phase 24.1.
 */
export async function registerPublicSiteSettingsRoutes(
  app: FastifyInstance,
  deps: PublicSiteSettingsRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const PublicSettingsSchema = z.object({
    currency: z.string(),
    defaultLocale: z.string(),
    locales: z.array(z.string()),
    brand: z.object({
      name: z.string(),
      tagline: z.string().optional(),
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
    }),
    storefront: z
      .object({
        heroHeadline: z.string().optional(),
        heroTagline: z.string().optional(),
        supportEmail: z.string().optional(),
        publicUrl: z.string().optional(),
      })
      .optional(),
  });

  zApp.get(
    '/v1/site',
    {
      schema: { response: { 200: z.object({ data: PublicSettingsSchema }) } },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const settings = await deps.settingsRepo.get(tenantId);
      return {
        data: {
          currency: settings.currency,
          defaultLocale: settings.defaultLocale,
          locales: settings.locales,
          brand: settings.brand,
          ...(settings.storefront ? { storefront: settings.storefront } : {}),
        },
      };
    },
  );
}
