import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  OrderLineSchema,
  OrderStatusSchema,
  OrderTotalsSchema,
} from '@claudeshop/contracts/order';
import { IsoDateTimeSchema, CurrencyCodeSchema } from '@claudeshop/contracts/common';
import type { OrderRepository } from '@claudeshop/core';

export interface PublicOrderTrackingRoutesDeps {
  orderRepo: OrderRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 36 — guest-safe order lookup. The merchant's storefront uses
 * this to power a `/track` page where a customer types their order
 * number + the email they used at checkout and gets back the status,
 * lines, and totals. We deliberately strip customerId and the raw
 * anonymousEmail from the response so this endpoint can't be abused
 * to harvest email ↔ customer-id mappings.
 *
 * Both fields must match; the email compare is case-insensitive and
 * whitespace-trimmed because people paste from clients that helpfully
 * add trailing spaces. A mismatch returns 404 with the same shape as
 * "no such order" — we never leak whether the number exists.
 */
export async function registerPublicOrderTrackingRoutes(
  app: FastifyInstance,
  deps: PublicOrderTrackingRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const TrackedOrderSchema = z.object({
    number: z.string(),
    status: OrderStatusSchema,
    currency: CurrencyCodeSchema,
    totals: OrderTotalsSchema,
    lines: z.array(
      OrderLineSchema.pick({
        id: true,
        productName: true,
        sku: true,
        qty: true,
        unitPrice: true,
        total: true,
      }),
    ),
    placedAt: IsoDateTimeSchema.nullable(),
    updatedAt: IsoDateTimeSchema,
  });

  zApp.get(
    '/v1/public/orders/track',
    {
      schema: {
        querystring: z.object({
          number: z.string().min(3).max(64),
          email: z.string().email(),
        }),
        response: {
          200: z.object({ data: TrackedOrderSchema }),
          404: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
              status: z.number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const order = await deps.orderRepo.findByNumber(
        tenantId,
        request.query.number.trim(),
      );

      const emailOnFile = order?.anonymousEmail?.trim().toLowerCase() ?? null;
      const candidate = request.query.email.trim().toLowerCase();
      const matched = order !== null && emailOnFile === candidate && emailOnFile !== null;

      if (!order || !matched) {
        // Uniform 404 regardless of which side failed so we don't
        // turn the endpoint into a "does order N exist" oracle.
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message:
              'No order matches that number + email. Double-check the confirmation email.',
            status: 404,
          },
        });
      }

      return {
        data: {
          number: order.number,
          status: order.status,
          currency: order.currency,
          totals: order.totals,
          lines: order.lines.map((line) => ({
            id: line.id,
            productName: line.productName,
            sku: line.sku,
            qty: line.qty,
            unitPrice: line.unitPrice,
            total: line.total,
          })),
          placedAt: order.placedAt,
          updatedAt: order.updatedAt,
        },
      };
    },
  );
}
