import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  OrderNoteRepository,
  OrderRepository,
} from '@claudeshop/core';
import {
  CreateOrderNoteInputSchema,
  OrderNoteSchema,
} from '@claudeshop/contracts/order';
import { NotFoundError } from '@claudeshop/errors';
import { recordFromRequest } from '../audit/record';

export interface AdminOrderNoteRoutesDeps {
  orderNoteRepo: OrderNoteRepository;
  orderRepo: OrderRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 42 — merchant-facing internal order timeline.
 *   GET /v1/admin/orders/:id/notes              paginated list
 *   POST /v1/admin/orders/:id/notes             append a user note
 *
 * Author identity (authorName + optional authorId) is supplied by
 * the admin caller via the request body because the API doesn't yet
 * see a user session — the admin Next server action forwards its own
 * `getCurrentSession()` into the payload. A future bearer-auth pass
 * will shift this to a request.user read.
 */
export async function registerAdminOrderNoteRoutes(
  app: FastifyInstance,
  deps: AdminOrderNoteRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/orders/:id/notes',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(OrderNoteSchema),
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

      // Surface a 404 when the order itself is gone — the client
      // should never silently render "0 notes" against a deleted
      // order.
      const order = await deps.orderRepo.findById(tenantId, request.params.id);
      if (!order) {
        throw new NotFoundError(`Order ${request.params.id} not found`);
      }

      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 100;
      const { items, total } = await deps.orderNoteRepo.list(
        tenantId,
        order.id,
        { page, limit },
      );
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/orders/:id/notes',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: CreateOrderNoteInputSchema.extend({
          authorName: z.string().trim().min(1).max(120),
          authorId: z.string().min(1).max(64).optional(),
        }),
        response: { 201: z.object({ data: OrderNoteSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const order = await deps.orderRepo.findById(tenantId, request.params.id);
      if (!order) {
        throw new NotFoundError(`Order ${request.params.id} not found`);
      }

      const note = await deps.orderNoteRepo.append(tenantId, {
        orderId: order.id,
        authorType: 'user',
        authorId: request.body.authorId ?? null,
        authorName: request.body.authorName,
        body: request.body.body,
      });

      // Best-effort audit trail. Never blocks note creation — if the
      // audit-logger hiccups we still want the note visible.
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        ...(request.body.authorId ? { actorId: request.body.authorId } : {}),
        action: 'order.note.append',
        resourceType: 'order',
        resourceId: order.id,
        diff: {
          noteId: note.id,
          authorName: note.authorName,
          preview: note.body.slice(0, 120),
        },
      });

      return reply.status(201).send({ data: note });
    },
  );
}
