import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PageStatusSchema } from '@claudeshop/contracts/page';
import { toCsv, type PageRepository } from '@claudeshop/core';

export interface AdminPagesExportRoutesDeps {
  pageRepo: PageRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 55 — CSV export for the admin CMS pages list. Seventh export
 * in the family (orders / customers / products / audit / inventory /
 * webhook deliveries / pages). Same UTF-8 BOM + Next proxy pattern.
 *
 * Localised title / body get the pickDisplayName treatment (prefer
 * 'en', fall back to first non-empty locale). Body is capped at 4 KB
 * with a "… [truncated]" marker so a long-form page doesn't balloon
 * the file — the JSON API carries full bodies when an editor needs
 * everything.
 */
export async function registerAdminPagesExportRoutes(
  app: FastifyInstance,
  deps: AdminPagesExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/pages/export.csv',
    {
      schema: {
        querystring: z.object({
          status: PageStatusSchema.optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const EXPORT_LIMIT = 5000;
      const { items } = await deps.pageRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.status ? { status: request.query.status } : {}),
      });

      const rows = items.map((p) => ({
        id: p.id,
        slug: p.slug,
        status: p.status,
        title: pickDisplayName(p.title),
        body_preview: truncate(pickDisplayName(p.body), 4000),
        seo_title: p.seo?.title ? pickDisplayName(p.seo.title) : '',
        seo_description: p.seo?.description
          ? pickDisplayName(p.seo.description)
          : '',
        author_id: p.authorId ?? '',
        published_at: p.publishedAt ?? '',
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }));

      const csv = toCsv(rows, {
        columns: [
          'id',
          'slug',
          'status',
          'title',
          'body_preview',
          'seo_title',
          'seo_description',
          'author_id',
          'published_at',
          'created_at',
          'updated_at',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `pages-${today}.csv`;
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

function pickDisplayName(value: Record<string, string>): string {
  if (value.en && value.en.trim()) return value.en;
  for (const v of Object.values(value)) {
    if (v && v.trim()) return v;
  }
  return '';
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 15)}… [truncated]`;
}
