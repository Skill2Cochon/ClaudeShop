import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  EmailProvider,
  InventoryRepository,
  TenantSettingsRepository,
} from '@claudeshop/core';
import { sendLowStockDigest } from '@claudeshop/core';
import { recordFromRequest } from '../audit/record.js';

export interface AdminInventoryDigestRoutesDeps {
  inventoryRepo: InventoryRepository;
  settingsRepo: TenantSettingsRepository;
  email: EmailProvider;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 52 — manual trigger for the low-stock digest email.
 *
 * POST /v1/admin/inventory/low-stock-digest  { to?, from?, limit? }
 *
 * Hosting-level schedulers (Coolify, n8n, GitHub Actions…) call this
 * endpoint on a cron to ship the digest. Merchants can also fire it
 * on demand from the /inventory page's "Send digest now" button —
 * useful after a big supplier disruption when the weekly cadence
 * isn't fast enough.
 *
 * Every call lands a `inventory.low_stock_digest.send` audit row so
 * the forensic trail shows who/when/how-many rows, separately from
 * whether the email actually delivered.
 */
export async function registerAdminInventoryDigestRoutes(
  app: FastifyInstance,
  deps: AdminInventoryDigestRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.post(
    '/v1/admin/inventory/low-stock-digest',
    {
      schema: {
        body: z.object({
          to: z.string().email().optional(),
          from: z.string().email().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
        response: {
          200: z.object({
            data: z.object({
              sent: z.boolean(),
              reason: z.string().optional(),
              rowCount: z.number(),
              to: z.string().optional(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const settings = await deps.settingsRepo.get(tenantId);
      const result = await sendLowStockDigest(
        {
          ...(request.body.to ? { to: request.body.to } : {}),
          ...(request.body.from ? { from: request.body.from } : {}),
          ...(request.body.limit !== undefined
            ? { limit: request.body.limit }
            : {}),
        },
        {
          tenantId,
          email: deps.email,
          inventoryRepo: deps.inventoryRepo,
          settings,
        },
      );

      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'inventory.low_stock_digest.send',
        resourceType: 'inventory',
        resourceId: 'digest',
        diff: {
          sent: result.sent,
          rowCount: result.rowCount,
          ...(result.reason ? { reason: result.reason } : {}),
          ...(result.to ? { to: result.to } : {}),
        },
      });

      return { data: result };
    },
  );
}
