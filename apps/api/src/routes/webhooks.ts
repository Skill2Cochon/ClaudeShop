import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  OrderRepository,
  PaymentProvider,
  PaymentRepository,
  WebhookEventRepository,
} from '@claudeshop/core';
import { PaymentError } from '@claudeshop/errors';

export interface WebhookRoutesDeps {
  paymentProvider: PaymentProvider;
  orderRepo: OrderRepository;
  paymentRepo: PaymentRepository;
  webhookEventRepo: WebhookEventRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Payment provider webhook intake. Signature verification uses the raw
 * request body (captured by the raw-body plugin) — re-serialised JSON would
 * break HMAC because Stripe signs exact bytes.
 *
 * Replay protection: each successfully verified event is recorded in the
 * `WebhookEvent` table. Duplicates (same provider + event id) are returned
 * 200 without re-processing so the PSP stops retrying.
 *
 * Phase 2.7: the handler updates Payment.status + Order.status on every
 * event type. tenantId is resolved from the header (Phase 2.8 adds a
 * provider-ref → tenant index for Stripe-forwarded webhooks).
 */
export async function registerWebhookRoutes(
  app: FastifyInstance,
  deps: WebhookRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.post('/v1/webhooks/payment', {
    schema: {
      response: {
        200: z.object({
          data: z.object({
            received: z.boolean(),
            replay: z.boolean().optional(),
          }),
        }),
      },
    },
    config: { rateLimit: false },
  }, async (request) => {
    const signature =
      request.headers['stripe-signature'] ?? request.headers['x-signature'];
    if (typeof signature !== 'string') {
      throw new PaymentError('Missing webhook signature header');
    }

    const rawBody =
      request.rawBody ??
      Buffer.from(
        typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {}),
      );

    const event = await deps.paymentProvider.verifyWebhook(rawBody, signature);
    if (!event) {
      throw new PaymentError('Invalid webhook signature');
    }

    const tenantId = deps.resolveTenantId({
      headers: request.headers as Record<string, unknown>,
    });

    let eventId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as { id?: unknown };
      if (typeof parsed.id === 'string') eventId = parsed.id;
    } catch {
      // Non-JSON body — skip replay check.
    }

    if (eventId) {
      const seen = await deps.webhookEventRepo.alreadyProcessed(
        deps.paymentProvider.name,
        eventId,
      );
      if (seen) {
        request.log.info(
          { provider: deps.paymentProvider.name, eventId, eventType: event.type },
          'Webhook replay — already processed',
        );
        return { data: { received: true, replay: true } };
      }
    }

    switch (event.type) {
      case 'payment.succeeded': {
        if (event.orderId) {
          await deps.orderRepo.updateStatus(tenantId, event.orderId, 'PAID');
        }
        const payment = await deps.paymentRepo.findByProviderRef(
          tenantId,
          deps.paymentProvider.name,
          event.providerRef,
        );
        if (payment) {
          await deps.paymentRepo.updateStatus(tenantId, payment.id, 'CAPTURED', new Date());
        }
        break;
      }
      case 'payment.failed': {
        if (event.orderId) {
          await deps.orderRepo.updateStatus(tenantId, event.orderId, 'CANCELLED');
        }
        const payment = await deps.paymentRepo.findByProviderRef(
          tenantId,
          deps.paymentProvider.name,
          event.providerRef,
        );
        if (payment) {
          await deps.paymentRepo.updateStatus(tenantId, payment.id, 'FAILED');
        }
        break;
      }
      case 'payment.refunded': {
        if (event.orderId) {
          await deps.orderRepo.updateStatus(tenantId, event.orderId, 'REFUNDED');
        }
        const payment = await deps.paymentRepo.findByProviderRef(
          tenantId,
          deps.paymentProvider.name,
          event.providerRef,
        );
        if (payment) {
          await deps.paymentRepo.updateStatus(tenantId, payment.id, 'REFUNDED');
        }
        break;
      }
    }

    if (eventId) {
      try {
        await deps.webhookEventRepo.recordProcessed({
          tenantId,
          provider: deps.paymentProvider.name,
          eventId,
          eventType: event.type,
          ...(event.orderId ? { orderId: event.orderId } : {}),
        });
      } catch (err) {
        request.log.warn(
          { err, provider: deps.paymentProvider.name, eventId },
          'Concurrent replay on recordProcessed',
        );
      }
    }

    return { data: { received: true } };
  });
}
