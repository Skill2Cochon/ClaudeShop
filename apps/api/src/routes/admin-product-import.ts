import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  SystemClock,
  importProductsBatch,
  type ProductRepository,
} from '@claudeshop/core';

export interface AdminProductImportRoutesDeps {
  productRepo: ProductRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

const RowResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('created'),
    slug: z.string(),
    productId: z.string(),
  }),
  z.object({
    status: z.literal('skipped'),
    slug: z.string(),
    reason: z.string(),
  }),
  z.object({
    status: z.literal('error'),
    slug: z.string().optional(),
    message: z.string(),
    rowIndex: z.number().int(),
  }),
]);

export async function registerAdminProductImportRoutes(
  app: FastifyInstance,
  deps: AdminProductImportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  zApp.post(
    '/v1/admin/products/import',
    {
      schema: {
        // `rows` are loosely validated here (z.unknown()) and re-validated
        // row-by-row inside the use-case so merchants get per-row error
        // diagnostics instead of a wholesale Zod barf.
        body: z.object({
          rows: z.array(z.unknown()).min(1).max(500),
          mode: z.enum(['skip', 'fail']).optional(),
        }),
        response: {
          200: z.object({
            data: z.object({
              created: z.number().int(),
              skipped: z.number().int(),
              errored: z.number().int(),
              total: z.number().int(),
              rows: z.array(RowResultSchema),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const result = await importProductsBatch(request.body, {
        tenantId,
        repo: deps.productRepo,
        clock,
      });
      return { data: result };
    },
  );
}
