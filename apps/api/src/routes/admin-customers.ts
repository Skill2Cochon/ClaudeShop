import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CustomerSchema,
  CustomerGroupSchema,
} from '@claudeshop/contracts/customer';
import { OrderSchema } from '@claudeshop/contracts/order';
import { NotFoundError } from '@claudeshop/errors';
import type {
  CustomerRepository,
  OrderRepository,
} from '@claudeshop/core';

export interface AdminCustomerRoutesDeps {
  customerRepo: CustomerRepository;
  orderRepo: OrderRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 34 — admin customer directory. Two surfaces:
 *   - GET /v1/admin/customers              → paginated + filterable list
 *   - GET /v1/admin/customers/:id          → detail + recent orders + LTV
 *
 * The detail endpoint joins OrderRepository.list so the merchant gets
 * the "who is this customer" overview in a single round-trip instead
 * of the admin issuing /customers/:id + /orders?customerId=… back to
 * back. Keeping that aggregation server-side also means a future
 * migration to a materialised view (once Phase 11.1's lifetime_value
 * column lands) is transparent to the admin app.
 */
export async function registerAdminCustomerRoutes(
  app: FastifyInstance,
  deps: AdminCustomerRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/customers',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
          query: z.string().trim().min(1).max(120).optional(),
          group: CustomerGroupSchema.optional(),
          acceptsMarketing: z
            .union([z.literal('true'), z.literal('false')])
            .transform((v) => v === 'true')
            .optional(),
        }),
        response: {
          200: z.object({
            data: z.array(CustomerSchema),
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
      const { items, total } = await deps.customerRepo.list(tenantId, {
        page,
        limit,
        ...(request.query.query ? { query: request.query.query } : {}),
        ...(request.query.group ? { group: request.query.group } : {}),
        ...(request.query.acceptsMarketing !== undefined
          ? { acceptsMarketing: request.query.acceptsMarketing }
          : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.get(
    '/v1/admin/customers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        querystring: z.object({
          orderLimit: z.coerce.number().int().positive().max(50).optional(),
        }),
        response: {
          200: z.object({
            data: z.object({
              customer: CustomerSchema,
              orders: z.array(OrderSchema),
              stats: z.object({
                orderCount: z.number(),
                lifetimeValue: z.string(),
                currency: z.string(),
                firstOrderAt: z.string().nullable(),
                lastOrderAt: z.string().nullable(),
              }),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const customer = await deps.customerRepo.findById(
        tenantId,
        request.params.id,
      );
      if (!customer) {
        throw new NotFoundError(`Customer ${request.params.id} not found`);
      }

      // Pull the last N orders for the timeline, then aggregate with a
      // second call that takes a larger slice so LTV reflects the full
      // relationship. 500 is a soft cap — merchants with heavier repeat
      // patterns will get a denormalised lifetime_value once Phase 11.1
      // lands.
      const orderLimit = request.query.orderLimit ?? 20;
      const [{ items: recentOrders }, { items: everyOrder, total: orderCount }] =
        await Promise.all([
          deps.orderRepo.list(tenantId, {
            page: 1,
            limit: orderLimit,
            customerId: customer.id,
          }),
          deps.orderRepo.list(tenantId, {
            page: 1,
            limit: 500,
            customerId: customer.id,
          }),
        ]);

      const stats = summariseLifetime(everyOrder, orderCount);

      return { data: { customer, orders: recentOrders, stats } };
    },
  );
}

interface LifetimeStats {
  orderCount: number;
  lifetimeValue: string;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

/**
 * Sum paid/fulfilled order totals into a single cents-accurate string.
 * Orders in DRAFT / CANCELLED / REFUNDED don't count toward LTV so a
 * cancelled €500 basket doesn't inflate the VIP-group metric.
 */
function summariseLifetime(
  orders: Array<{ status: string; totals: { total: string }; currency: string; placedAt: string | null; createdAt: string }>,
  orderCount: number,
): LifetimeStats {
  const VALID_FOR_LTV = new Set([
    'PAID',
    'FULFILLING',
    'SHIPPED',
    'DELIVERED',
  ]);
  let cents = 0n;
  let currency = orders[0]?.currency ?? 'EUR';
  let firstOrderAt: string | null = null;
  let lastOrderAt: string | null = null;

  for (const o of orders) {
    const when = o.placedAt ?? o.createdAt;
    if (firstOrderAt === null || when < firstOrderAt) firstOrderAt = when;
    if (lastOrderAt === null || when > lastOrderAt) lastOrderAt = when;
    if (VALID_FOR_LTV.has(o.status)) {
      const parsed = parseMoneyToCents(o.totals.total);
      cents += parsed;
      currency = o.currency;
    }
  }

  return {
    orderCount,
    lifetimeValue: formatCents(cents),
    currency,
    firstOrderAt,
    lastOrderAt,
  };
}

/**
 * Convert a "12.34" string into a BigInt of cents so we can aggregate
 * without floating-point drift across thousands of orders.
 */
function parseMoneyToCents(value: string): bigint {
  const clean = value.trim();
  if (!clean) return 0n;
  const [whole, fraction = ''] = clean.split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);
  const sign = whole?.startsWith('-') ? -1n : 1n;
  const wholeAbs = (whole ?? '').replace('-', '');
  const asBigInt = BigInt(wholeAbs || '0') * 100n + BigInt(paddedFraction || '0');
  return sign * asBigInt;
}

function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}
