import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  EmailProvider,
  InventoryRepository,
  OrderNoteRepository,
  OrderRepository,
  TenantSettingsRepository,
} from '@claudeshop/core';
import {
  sendOrderTransactional,
  transitionOrderStatus,
  type OrderTransactionalKind,
} from '@claudeshop/core';
import {
  OrderSchema,
  OrderStatusSchema,
} from '@claudeshop/contracts/order';
import { recordFromRequest } from '../audit/record.js';

export interface AdminOrderRoutesDeps {
  orderRepo: OrderRepository;
  inventoryRepo: InventoryRepository;
  auditLogRepo: AuditLogRepository;
  /** Phase 43 — optional. When present the route writes a system
   * note on every status transition so the order timeline tells
   * the story without manual entry. */
  orderNoteRepo?: OrderNoteRepository;
  email: EmailProvider;
  settingsRepo: TenantSettingsRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Admin-only order fulfilment surface. The public orders route already
 * handles create/read/list; this one owns state transitions and writes
 * an audit row per transition so forensics can trace who moved each
 * order through its lifecycle.
 */
export async function registerAdminOrderRoutes(
  app: FastifyInstance,
  deps: AdminOrderRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.post(
    '/v1/admin/orders/:id/status',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ next: OrderStatusSchema }),
        response: { 200: z.object({ data: OrderSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      // Snapshot the previous status so the audit diff is useful.
      const previous = await deps.orderRepo.findById(tenantId, request.params.id);
      const fromStatus = previous?.status ?? null;

      const updated = await transitionOrderStatus(
        { orderId: request.params.id, next: request.body.next },
        {
          tenantId,
          orderRepo: deps.orderRepo,
          inventoryRepo: deps.inventoryRepo,
        },
      );

      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'order.status.transition',
        resourceType: 'order',
        resourceId: updated.id,
        diff: { from: fromStatus, to: updated.status, number: updated.number },
      });

      // Phase 43 — append a system note so the timeline has a narrative
      // without merchants typing "status changed" by hand. Best-effort:
      // a note-write hiccup should never block the transition response.
      if (deps.orderNoteRepo) {
        try {
          await deps.orderNoteRepo.append(tenantId, {
            orderId: updated.id,
            authorType: 'system',
            authorId: null,
            authorName: 'ClaudeShop',
            body: fromStatus
              ? `Status: ${fromStatus} → ${updated.status}`
              : `Status set to ${updated.status}`,
          });
        } catch (err) {
          request.log.warn(
            { err, orderId: updated.id, tenantId },
            'System note on status transition failed — continuing',
          );
        }
      }

      // Fire the matching transactional email best-effort. A send failure
      // must NOT roll back the status transition — the merchant has
      // already visibly moved the order, and a bounced email is a
      // comms-layer problem, not a transaction boundary problem.
      const kind = kindForTransition(updated.status);
      if (kind) {
        try {
          const settings = await deps.settingsRepo.get(tenantId);
          await sendOrderTransactional(
            { kind, order: updated },
            { tenantId, email: deps.email, settings },
          );
        } catch (err) {
          request.log.warn(
            { err, orderId: updated.id, kind, tenantId },
            'Transactional order email failed — continuing',
          );
        }
      }

      return { data: updated };
    },
  );
}

/** Map terminal-ish transitions onto their transactional email kind. */
function kindForTransition(
  next: (typeof OrderStatusSchema._def.values)[number],
): OrderTransactionalKind | null {
  switch (next) {
    case 'SHIPPED':
      return 'shipped';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return null;
  }
}
