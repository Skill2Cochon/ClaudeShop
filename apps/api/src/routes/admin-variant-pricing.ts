import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { VariantRepository } from '@claudeshop/core';
import { PriceSetSchema } from '@claudeshop/contracts/product';

export interface AdminVariantPricingRoutesDeps {
  variantRepo: VariantRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Admin variant pricing surface (Phase 30). Scoped to /v1/admin/variants/:id
 * because PriceSet rows are always per-variant — no need for a top-level
 * /prices endpoint that would force the caller to pass variantId as a body
 * field.
 */
export async function registerAdminVariantPricingRoutes(
  app: FastifyInstance,
  deps: AdminVariantPricingRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const UpsertBody = z.object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'ISO-4217 3-letter code (will be uppercased server-side)'),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Decimal like 29.00'),
    channel: z.string().min(1).max(32).optional(),
    validFrom: z.string().datetime().nullable().optional(),
    validTo: z.string().datetime().nullable().optional(),
    taxIncluded: z.boolean().optional(),
  });

  zApp.get(
    '/v1/admin/variants/:id/prices',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: z.array(PriceSetSchema) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const prices = await deps.variantRepo.listPrices(tenantId, request.params.id);
      return { data: prices };
    },
  );

  zApp.put(
    '/v1/admin/variants/:id/prices',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpsertBody,
        response: { 200: z.object({ data: PriceSetSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const priceSet = await deps.variantRepo.upsertPrice(
        tenantId,
        request.params.id,
        {
          currency: request.body.currency.toUpperCase(),
          amount: request.body.amount,
          ...(request.body.channel !== undefined ? { channel: request.body.channel } : {}),
          ...(request.body.validFrom !== undefined
            ? { validFrom: request.body.validFrom }
            : {}),
          ...(request.body.validTo !== undefined ? { validTo: request.body.validTo } : {}),
          ...(request.body.taxIncluded !== undefined
            ? { taxIncluded: request.body.taxIncluded }
            : {}),
        },
      );
      return { data: priceSet };
    },
  );

  zApp.delete(
    '/v1/admin/variants/:id/prices',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        querystring: z.object({
          currency: z.string().regex(/^[A-Za-z]{3}$/),
          channel: z.string().min(1).max(32).optional(),
        }),
        response: { 200: z.object({ data: z.object({ removed: z.boolean() }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.variantRepo.deletePrice(tenantId, request.params.id, {
        currency: request.query.currency.toUpperCase(),
        ...(request.query.channel !== undefined ? { channel: request.query.channel } : {}),
      });
      return { data: { removed: true } };
    },
  );
}
