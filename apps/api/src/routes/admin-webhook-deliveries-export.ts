import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { WebhookDeliveryStatusSchema } from '@claudeshop/contracts/webhook';
import { CuidSchema } from '@claudeshop/contracts/common';
import { toCsv, type WebhookDeliveryRepository } from '@claudeshop/core';

export interface AdminWebhookDeliveriesExportRoutesDeps {
  deliveryRepo: WebhookDeliveryRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 48 — CSV export for webhook deliveries. Sixth export in the
 * set. Reuses the same filter shape as the /v1/admin/webhook-
 * deliveries list (status, eventType, subscriptionId) so an operator
 * who's looking at "all FAILED deliveries for order.placed" can
 * download exactly that slice.
 *
 * Payload + responseBody are potentially large — we cap the column
 * at 4 KB so a handful of bloated payloads don't balloon the file.
 * A full dump is always one click away via the JSON API.
 */
export async function registerAdminWebhookDeliveriesExportRoutes(
  app: FastifyInstance,
  deps: AdminWebhookDeliveriesExportRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/webhook-deliveries/export.csv',
    {
      schema: {
        querystring: z.object({
          status: WebhookDeliveryStatusSchema.optional(),
          eventType: z.string().trim().min(1).max(120).optional(),
          subscriptionId: CuidSchema.optional(),
        }),
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const EXPORT_LIMIT = 5000;
      const { items } = await deps.deliveryRepo.list(tenantId, {
        page: 1,
        limit: EXPORT_LIMIT,
        ...(request.query.status ? { status: request.query.status } : {}),
        ...(request.query.eventType ? { eventType: request.query.eventType } : {}),
        ...(request.query.subscriptionId
          ? { subscriptionId: request.query.subscriptionId }
          : {}),
      });

      const rows = items.map((d) => ({
        id: d.id,
        created_at: d.createdAt,
        event_type: d.eventType,
        event_id: d.eventId,
        subscription_id: d.subscriptionId,
        status: d.status,
        attempt_count: d.attemptCount,
        last_attempt_at: d.lastAttemptAt ?? '',
        delivered_at: d.deliveredAt ?? '',
        response_status: d.responseStatus ?? '',
        response_body: truncate(d.responseBody, 4000),
        error_message: d.errorMessage ?? '',
        payload: truncate(
          d.payload === null || d.payload === undefined
            ? ''
            : JSON.stringify(d.payload),
          4000,
        ),
      }));

      const csv = toCsv(rows, {
        columns: [
          'id',
          'created_at',
          'event_type',
          'event_id',
          'subscription_id',
          'status',
          'attempt_count',
          'last_attempt_at',
          'delivered_at',
          'response_status',
          'response_body',
          'error_message',
          'payload',
        ],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `webhook-deliveries-${today}.csv`;
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
 * Clip a string to maxLen characters with a trailing marker so the
 * analyst can tell at a glance that the cell was truncated. Used
 * for payload + response body, which can run to hundreds of KB on
 * verbose webhooks.
 */
function truncate(value: string | null, maxLen: number): string {
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 15)}… [truncated]`;
}
