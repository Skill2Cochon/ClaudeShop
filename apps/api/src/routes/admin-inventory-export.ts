import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { toCsv, type InventoryRepository } from '@claudeshop/core';

export interface AdminInventoryExportRoutesDeps {
  inventoryRepo: InventoryRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 46 — CSV export for the admin inventory dashboard. Fifth
 * export in the set; parallels Phases 38-41 + 45 in shape (UTF-8
 * BOM, Next proxy layered on top, querystring-scoped filters).
 *
 * Ships the InventoryProjection joined to variant + product —
 * merchants export this to hand to a warehouse partner or to review
 * a low-stock list in Excel, so we give them SKU + product name
 * alongside the stock numbers rather than just variantId.
 */
export async function registerAdminInventoryExportRoutes(
  app: FastifyInstance,
  deps: AdminInventoryExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/inventory/export.csv',
    {
      schema: {
        querystring: z.object({
          lowOnly: z
            .union([z.literal('true'), z.literal('false')])
            .transform((v) => v === 'true')
            .optional(),
          outOfStockOnly: z
            .union([z.literal('true'), z.literal('false')])
            .transform((v) => v === 'true')
            .optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const EXPORT_LIMIT = 5000;
      const { items } = await deps.inventoryRepo.listProjections(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.lowOnly !== undefined
          ? { lowOnly: request.query.lowOnly }
          : {}),
        ...(request.query.outOfStockOnly !== undefined
          ? { outOfStockOnly: request.query.outOfStockOnly }
          : {}),
      });

      const rows = items.map((item) => ({
        variant_id: item.variantId,
        sku: item.sku,
        product_id: item.productId,
        product_slug: item.productSlug,
        product_name: pickDisplayName(item.productName),
        location_id: item.locationId,
        on_hand: item.onHand,
        reserved: item.reserved,
        safety_stock: item.safetyStock,
        available: item.available,
        // Inline status tag so the exporter can sort on it in Excel
        // without re-implementing the rule server-side.
        status:
          item.onHand <= 0
            ? 'out_of_stock'
            : item.available <= 0
              ? 'below_safety'
              : 'healthy',
        updated_at: item.updatedAt,
      }));

      const csv = toCsv(rows, {
        columns: [
          'variant_id',
          'sku',
          'product_id',
          'product_slug',
          'product_name',
          'location_id',
          'on_hand',
          'reserved',
          'safety_stock',
          'available',
          'status',
          'updated_at',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `inventory-${today}.csv`;
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

/**
 * Same pickDisplayName pattern as Phase 41's product export: prefer
 * 'en', fall back to the first non-empty locale, empty string as
 * a final safety net. Duplicated across exports because pulling it
 * into @claudeshop/core would force the shared package to hold a
 * column-presentation opinion — cheaper to keep the 10-liner local
 * to each export surface.
 */
function pickDisplayName(name: Record<string, string>): string {
  if (name.en && name.en.trim()) return name.en;
  for (const value of Object.values(name)) {
    if (value && value.trim()) return value;
  }
  return '';
}
