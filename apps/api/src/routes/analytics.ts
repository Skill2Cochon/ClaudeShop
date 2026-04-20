import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AnalyticsRepository } from '@claudeshop/core';

export interface AnalyticsRoutesDeps {
  repo: AnalyticsRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  deps: AnalyticsRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const RevenueWindowSchema = z.object({
    date: z.string(),
    revenue: z.string(),
    orderCount: z.number(),
  });

  const RevenueSummarySchema = z.object({
    total: z.string(),
    orderCount: z.number(),
    currency: z.string(),
    buckets: z.array(RevenueWindowSchema),
  });

  const TopProductSchema = z.object({
    productId: z.string(),
    sku: z.string(),
    productName: z.string(),
    qty: z.number(),
    revenue: z.string(),
  });

  const InventoryHealthSchema = z.object({
    totalVariants: z.number(),
    lowStockCount: z.number(),
    outOfStockCount: z.number(),
    overstockCount: z.number(),
  });

  const OrderStatusBreakdownSchema = z.object({
    counts: z.record(z.number()),
    windowDays: z.number(),
  });

  zApp.get(
    '/v1/admin/analytics/overview',
    {
      schema: {
        querystring: z.object({
          days: z.coerce.number().int().positive().max(365).optional(),
          topLimit: z.coerce.number().int().positive().max(50).optional(),
        }),
        response: {
          200: z.object({
            data: z.object({
              window: z.object({ days: z.number() }),
              revenue: RevenueSummarySchema,
              topProducts: z.array(TopProductSchema),
              inventory: InventoryHealthSchema,
              orderStatus: OrderStatusBreakdownSchema,
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const days = request.query.days ?? 30;
      const topLimit = request.query.topLimit ?? 5;

      const [revenue, topProducts, inventory, orderStatus] = await Promise.all([
        deps.repo.getRevenueSummary(tenantId, { days }),
        deps.repo.getTopProducts(tenantId, { days, limit: topLimit }),
        deps.repo.getInventoryHealth(tenantId),
        deps.repo.getOrderStatusBreakdown(tenantId, { days }),
      ]);

      return {
        data: {
          window: { days },
          revenue,
          topProducts,
          inventory,
          orderStatus,
        },
      };
    },
  );
}
