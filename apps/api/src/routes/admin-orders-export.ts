import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CuidSchema } from '@claudeshop/contracts/common';
import { OrderStatusSchema } from '@claudeshop/contracts/order';
import { toCsv, type OrderRepository } from '@claudeshop/core';

export interface AdminOrdersExportRoutesDeps {
  orderRepo: OrderRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 38 — CSV export for the admin orders list. Reuses the same
 * filter shape as GET /v1/orders (status, customerId, customerEmail,
 * numberQuery, placedFrom/To) so the merchant can export exactly the
 * slice they have on screen, not "everything ever".
 *
 * Hard cap at 5000 rows per export. If a merchant genuinely needs
 * a full-year dump they either narrow by date range or we upgrade
 * this to paginated streaming — but that's Phase 41+ territory.
 */
export async function registerAdminOrdersExportRoutes(
  app: FastifyInstance,
  deps: AdminOrdersExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/orders/export.csv',
    {
      schema: {
        querystring: z.object({
          status: OrderStatusSchema.optional(),
          customerId: CuidSchema.optional(),
          customerEmail: z.string().email().optional(),
          numberQuery: z.string().trim().min(1).max(64).optional(),
          placedFrom: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          placedTo: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const placedFrom = request.query.placedFrom
        ? `${request.query.placedFrom}T00:00:00.000Z`
        : undefined;
      const placedTo = request.query.placedTo
        ? `${request.query.placedTo}T23:59:59.999Z`
        : undefined;

      // Hard 5k cap. The list method on OrderRepository is paginated;
      // we ask for one big page because exports are bounded by intent
      // (merchant filter) rather than pagination.
      const EXPORT_LIMIT = 5000;
      const { items } = await deps.orderRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.status ? { status: request.query.status } : {}),
        ...(request.query.customerId ? { customerId: request.query.customerId } : {}),
        ...(request.query.customerEmail
          ? { customerEmail: request.query.customerEmail }
          : {}),
        ...(request.query.numberQuery
          ? { numberQuery: request.query.numberQuery }
          : {}),
        ...(placedFrom ? { placedFrom } : {}),
        ...(placedTo ? { placedTo } : {}),
      });

      const rows = items.map((order) => ({
        number: order.number,
        status: order.status,
        currency: order.currency,
        customer_email: order.anonymousEmail ?? '',
        customer_id: order.customerId ?? '',
        subtotal: order.totals.subtotal,
        tax: order.totals.tax,
        shipping: order.totals.shipping,
        discount: order.totals.discount,
        total: order.totals.total,
        line_count: order.lines.length,
        placed_at: order.placedAt ?? '',
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      }));

      const csv = toCsv(rows, {
        columns: [
          'number',
          'status',
          'currency',
          'customer_email',
          'customer_id',
          'subtotal',
          'tax',
          'shipping',
          'discount',
          'total',
          'line_count',
          'placed_at',
          'created_at',
          'updated_at',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `orders-${today}.csv`;

      // UTF-8 BOM so Excel opens non-ASCII fields (product names,
      // addresses) in the right encoding without prompting. This is
      // the single most common "exported CSV looks garbled" trap.
      const BOM = '\ufeff';

      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header(
          'content-disposition',
          `attachment; filename="${filename}"`,
        )
        .send(BOM + csv);
    },
  );
}
