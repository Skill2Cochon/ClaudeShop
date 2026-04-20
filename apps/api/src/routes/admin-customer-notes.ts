import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  CustomerNoteRepository,
  CustomerRepository,
} from '@claudeshop/core';
import {
  CreateCustomerNoteInputSchema,
  CustomerNoteSchema,
} from '@claudeshop/contracts/customer';
import { NotFoundError } from '@claudeshop/errors';
import { recordFromRequest } from '../audit/record.js';

export interface AdminCustomerNoteRoutesDeps {
  customerNoteRepo: CustomerNoteRepository;
  customerRepo: CustomerRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 44 — merchant-facing CRM timeline. Mirrors the Phase 42
 * order-notes surface:
 *   GET  /v1/admin/customers/:id/notes    paginated list
 *   POST /v1/admin/customers/:id/notes    append a user note
 *
 * Author identity (authorName + optional authorId) is supplied by
 * the admin caller via the request body because the API doesn't
 * yet see a user session. A future bearer-auth pass will shift
 * this to a request.user read.
 */
export async function registerAdminCustomerNoteRoutes(
  app: FastifyInstance,
  deps: AdminCustomerNoteRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/customers/:id/notes',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(200).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(CustomerNoteSchema),
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
      const customer = await deps.customerRepo.findById(
        tenantId,
        request.params.id,
      );
      if (!customer) {
        throw new NotFoundError(
          `Customer ${request.params.id} not found`,
        );
      }
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 100;
      const { items, total } = await deps.customerNoteRepo.list(
        tenantId,
        customer.id,
        { page, limit },
      );
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/customers/:id/notes',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: CreateCustomerNoteInputSchema.extend({
          authorName: z.string().trim().min(1).max(120),
          authorId: z.string().min(1).max(64).optional(),
        }),
        response: { 201: z.object({ data: CustomerNoteSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const customer = await deps.customerRepo.findById(
        tenantId,
        request.params.id,
      );
      if (!customer) {
        throw new NotFoundError(
          `Customer ${request.params.id} not found`,
        );
      }

      const note = await deps.customerNoteRepo.append(tenantId, {
        customerId: customer.id,
        authorType: 'user',
        authorId: request.body.authorId ?? null,
        authorName: request.body.authorName,
        body: request.body.body,
      });

      // Best-effort audit trail.
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        ...(request.body.authorId ? { actorId: request.body.authorId } : {}),
        action: 'customer.note.append',
        resourceType: 'customer',
        resourceId: customer.id,
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
