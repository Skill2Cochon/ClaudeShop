import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CustomerGroupSchema } from '@claudeshop/contracts/customer';
import { toCsv, type CustomerRepository } from '@claudeshop/core';

export interface AdminCustomersExportRoutesDeps {
  customerRepo: CustomerRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 39 — CSV export for the admin customers directory. Parallels
 * Phase 38's orders export: same filter shape as
 * GET /v1/admin/customers, same 5000-row soft cap, same UTF-8 BOM so
 * Excel opens accented names cleanly.
 */
export async function registerAdminCustomersExportRoutes(
  app: FastifyInstance,
  deps: AdminCustomersExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/customers/export.csv',
    {
      schema: {
        querystring: z.object({
          query: z.string().trim().min(1).max(120).optional(),
          group: CustomerGroupSchema.optional(),
          acceptsMarketing: z
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
      const { items } = await deps.customerRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.query ? { query: request.query.query } : {}),
        ...(request.query.group ? { group: request.query.group } : {}),
        ...(request.query.acceptsMarketing !== undefined
          ? { acceptsMarketing: request.query.acceptsMarketing }
          : {}),
      });

      const rows = items.map((c) => ({
        id: c.id,
        email: c.email,
        first_name: c.firstName ?? '',
        last_name: c.lastName ?? '',
        phone: c.phone ?? '',
        group: c.group,
        accepts_marketing: c.acceptsMarketing ? 'yes' : 'no',
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }));

      const csv = toCsv(rows, {
        columns: [
          'id',
          'email',
          'first_name',
          'last_name',
          'phone',
          'group',
          'accepts_marketing',
          'created_at',
          'updated_at',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `customers-${today}.csv`;
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
