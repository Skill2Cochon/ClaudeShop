import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateTaxRateInputSchema,
  TaxRateSchema,
  UpdateTaxRateInputSchema,
} from '@claudeshop/contracts/checkout';
import type { TaxRateRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface TaxRateRoutesDeps {
  repo: TaxRateRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerTaxRateRoutes(
  app: FastifyInstance,
  deps: TaxRateRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/tax-rates',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          isActive: z.enum(['true', 'false']).optional(),
          countryCode: z.string().length(2).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(TaxRateSchema),
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
        ...(request.query.countryCode
          ? { countryCode: request.query.countryCode.toUpperCase() }
          : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/tax-rates',
    {
      schema: {
        body: CreateTaxRateInputSchema,
        response: { 201: z.object({ data: TaxRateSchema }) },
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
    '/v1/admin/tax-rates/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: TaxRateSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const rate = await deps.repo.findById(tenantId, request.params.id);
      if (!rate) throw new NotFoundError(`Tax rate ${request.params.id} not found`);
      return { data: rate };
    },
  );

  zApp.patch(
    '/v1/admin/tax-rates/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateTaxRateInputSchema,
        response: { 200: z.object({ data: TaxRateSchema }) },
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
    '/v1/admin/tax-rates/:id',
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
}
