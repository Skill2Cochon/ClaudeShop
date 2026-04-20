import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateShippingRateInputSchema,
  ShippingRateSchema,
  UpdateShippingRateInputSchema,
} from '@claudeshop/contracts/checkout';
import type { ShippingRateRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface ShippingRateRoutesDeps {
  repo: ShippingRateRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerShippingRateRoutes(
  app: FastifyInstance,
  deps: ShippingRateRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/shipping-rates',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          isActive: z.enum(['true', 'false']).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(ShippingRateSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 50;
      const isActive =
        request.query.isActive === undefined
          ? undefined
          : request.query.isActive === 'true';
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        ...(isActive !== undefined ? { isActive } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/shipping-rates',
    {
      schema: {
        body: CreateShippingRateInputSchema,
        response: { 201: z.object({ data: ShippingRateSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const rate = await deps.repo.create(tenantId, request.body);
      return reply.status(201).send({ data: rate });
    },
  );

  zApp.get(
    '/v1/admin/shipping-rates/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: ShippingRateSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const rate = await deps.repo.findById(tenantId, request.params.id);
      if (!rate) throw new NotFoundError(`Shipping rate ${request.params.id} not found`);
      return { data: rate };
    },
  );

  zApp.patch(
    '/v1/admin/shipping-rates/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateShippingRateInputSchema,
        response: { 200: z.object({ data: ShippingRateSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const rate = await deps.repo.update(tenantId, request.params.id, request.body);
      return { data: rate };
    },
  );

  zApp.delete(
    '/v1/admin/shipping-rates/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: z.object({ deleted: z.boolean() }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.repo.delete(tenantId, request.params.id);
      return { data: { deleted: true } };
    },
  );

  // --- Public: GET /v1/shipping-rates/quote -------------------------------
  // Storefront cart calls this to show shipping options before checkout.
  zApp.get(
    '/v1/shipping-rates/quote',
    {
      schema: {
        querystring: z.object({
          country: z.string().length(2),
          currency: z.string().length(3),
          subtotalCents: z.coerce.number().int().min(0),
        }),
        response: { 200: z.object({ data: z.array(ShippingRateSchema) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const items = await deps.repo.findApplicable(tenantId, {
        country: request.query.country.toUpperCase(),
        currency: request.query.currency.toUpperCase(),
        subtotalCents: request.query.subtotalCents,
      });
      return { data: items };
    },
  );
}
