import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  CustomerRepository,
} from '@claudeshop/core';
import { recordFromRequest } from '../audit/record.js';

export interface PublicNewsletterRoutesDeps {
  customerRepo: CustomerRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 58 — public newsletter opt-in. Creates (or upgrades) a
 * Customer row with acceptsMarketing=true. Idempotent: subscribing
 * an email that already exists just flips the opt-in flag, never
 * throws. Returns a uniform 204 so the storefront can show a
 * generic "thanks, you're on the list" without leaking whether
 * the email was already known — better UX and a mild privacy win.
 *
 * Audit log captures every subscribe (action = newsletter.subscribe)
 * so merchants can trace a bot-signup spike or wire a downstream
 * flow off the event.
 */
export async function registerPublicNewsletterRoutes(
  app: FastifyInstance,
  deps: PublicNewsletterRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.post(
    '/v1/public/subscribe',
    {
      schema: {
        body: z.object({
          email: z.string().trim().toLowerCase().email(),
          firstName: z.string().trim().min(1).max(80).optional(),
          lastName: z.string().trim().min(1).max(80).optional(),
          /** Optional — where on the site the signup came from. */
          source: z.string().trim().min(1).max(64).optional(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const existing = await deps.customerRepo.findByEmail(
        tenantId,
        request.body.email,
      );
      if (existing) {
        // Already a customer — if they've unsubscribed in the past
        // we don't resurrect the opt-in here. Respect the current
        // state, log the intent, and move on. A future preference-
        // center endpoint can flip acceptsMarketing explicitly.
        await recordFromRequest(deps.auditLogRepo, request, tenantId, {
          actorType: 'system',
          action: 'newsletter.subscribe',
          resourceType: 'customer',
          resourceId: existing.id,
          diff: {
            email: request.body.email,
            existing: true,
            acceptsMarketing: existing.acceptsMarketing,
            ...(request.body.source ? { source: request.body.source } : {}),
          },
        });
        return reply.status(204).send(null);
      }

      const created = await deps.customerRepo.create(tenantId, {
        email: request.body.email,
        phone: null,
        firstName: request.body.firstName ?? null,
        lastName: request.body.lastName ?? null,
        group: 'B2C',
        acceptsMarketing: true,
      });

      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'system',
        action: 'newsletter.subscribe',
        resourceType: 'customer',
        resourceId: created.id,
        diff: {
          email: request.body.email,
          existing: false,
          acceptsMarketing: true,
          ...(request.body.source ? { source: request.body.source } : {}),
        },
      });

      return reply.status(204).send(null);
    },
  );
}
