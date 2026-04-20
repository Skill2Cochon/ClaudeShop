import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ProductStatusSchema } from '@claudeshop/contracts/product';
import { toCsv, type ProductRepository } from '@claudeshop/core';

export interface AdminProductsExportRoutesDeps {
  productRepo: ProductRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 41 — CSV export for the admin products catalog. Third export
 * in the trilogy (orders + customers + products). Hard-cap at 5000
 * rows, UTF-8 BOM, one row per product. Variant details are
 * summarised inline as a count + semicolon-joined SKU list so the
 * merchant gets a single-sheet-per-product export instead of a
 * separate variant file — the dedicated /import flow already knows
 * how to round-trip variants for bulk updates.
 */
export async function registerAdminProductsExportRoutes(
  app: FastifyInstance,
  deps: AdminProductsExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/products/export.csv',
    {
      schema: {
        querystring: z.object({
          status: ProductStatusSchema.optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const EXPORT_LIMIT = 5000;
      const { items } = await deps.productRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.status ? { status: request.query.status } : {}),
      });

      const rows = items.map((p) => ({
        id: p.id,
        slug: p.slug,
        status: p.status,
        type: p.type,
        name: pickDisplayName(p.name),
        variant_count: p.variants.length,
        // Semicolon keeps SKU lists readable inside a single cell —
        // comma would fight the column separator once a merchant
        // opens the file in Numbers/Sheets where auto-detection can
        // over-aggressively split fields.
        variant_skus: p.variants.map((v) => v.sku).join('; '),
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }));

      const csv = toCsv(rows, {
        columns: [
          'id',
          'slug',
          'status',
          'type',
          'name',
          'variant_count',
          'variant_skus',
          'created_at',
          'updated_at',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `products-${today}.csv`;
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
 * Pick a single human-friendly string from a LocalizedString
 * (Record<locale, string>). Prefers 'en' when present, then the
 * first non-empty value, then '' — covers the "merchant typed
 * French only" and "merchant typed English only" cases without
 * forcing a default locale parameter into the export URL.
 */
function pickDisplayName(name: Record<string, string>): string {
  if (name.en && name.en.trim()) return name.en;
  for (const value of Object.values(name)) {
    if (value && value.trim()) return value;
  }
  return '';
}
