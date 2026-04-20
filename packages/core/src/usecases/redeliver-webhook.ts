import { createHmac } from 'node:crypto';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { WebhookDelivery } from '@claudeshop/contracts/webhook';
import type { HttpClient } from '../ports/http-client.js';
import type { WebhookDeliveryRepository } from '../ports/webhook-delivery-repository.js';
import type { WebhookSubscriptionRepository } from '../ports/webhook-subscription-repository.js';
import type { Clock } from '../ports/clock.js';

export interface RedeliverWebhookInput {
  deliveryId: string;
}

export interface RedeliverWebhookDeps {
  tenantId: string;
  subscriptionRepo: WebhookSubscriptionRepository;
  deliveryRepo: WebhookDeliveryRepository;
  http: HttpClient;
  clock: Clock;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Manually retry a specific WebhookDelivery. Reuses the stored payload +
 * metadata so the HMAC matches the original body shape, then calls the
 * subscription's URL and records the attempt via recordAttempt — exactly
 * the same code path dispatchWebhookEvent uses.
 *
 * Contract:
 *  - Throws NotFoundError when the delivery doesn't exist in the tenant or
 *    its subscription has been deleted.
 *  - Throws ValidationError when the subscription is disabled (an admin
 *    can re-enable it first if they really want to force delivery).
 *  - Already-DELIVERED rows are still redelivered because the admin
 *    explicitly clicked the button — the use case trusts the click.
 */
export async function redeliverWebhook(
  input: RedeliverWebhookInput,
  deps: RedeliverWebhookDeps,
): Promise<WebhookDelivery> {
  const delivery = await deps.deliveryRepo.findById(
    deps.tenantId,
    input.deliveryId,
  );
  if (!delivery) {
    throw new NotFoundError(`Delivery ${input.deliveryId} not found`, {
      details: { deliveryId: input.deliveryId, tenantId: deps.tenantId },
    });
  }

  const subscription = await deps.subscriptionRepo.findById(
    deps.tenantId,
    delivery.subscriptionId,
  );
  if (!subscription) {
    throw new NotFoundError(
      `Subscription ${delivery.subscriptionId} not found for redelivery`,
      { details: { subscriptionId: delivery.subscriptionId } },
    );
  }

  // Re-enable guard: if the subscription was turned off the admin almost
  // certainly wants to re-enable it first, not send a phantom event.
  if (!subscription.isActive) {
    throw new ValidationError(
      `Subscription ${subscription.id} is inactive; re-enable it before redelivering.`,
      { details: { subscriptionId: subscription.id } },
    );
  }

  const body = JSON.stringify({
    eventType: delivery.eventType,
    eventId: delivery.eventId,
    tenantId: deps.tenantId,
    occurredAt: deps.clock.nowIso(),
    payload: delivery.payload,
    redelivery: true,
  });
  const signature = signBody(subscription.secret, body);
  const attemptedAt = deps.clock.now();

  try {
    const response = await deps.http.send({
      url: subscription.url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-claudeshop-event': delivery.eventType,
        'x-claudeshop-delivery': delivery.id,
        'x-claudeshop-redelivery': 'true',
        'x-claudeshop-signature': `sha256=${signature}`,
      },
      body,
      timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    const delivered = response.status >= 200 && response.status < 300;
    return deps.deliveryRepo.recordAttempt(deps.tenantId, delivery.id, {
      status: delivered ? 'DELIVERED' : 'FAILED',
      responseStatus: response.status,
      responseBody: response.body.slice(0, 4_000),
      attemptedAt,
      ...(delivered ? { deliveredAt: attemptedAt } : {}),
      ...(delivered ? {} : { errorMessage: `HTTP ${response.status}` }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return deps.deliveryRepo.recordAttempt(deps.tenantId, delivery.id, {
      status: 'FAILED',
      attemptedAt,
      errorMessage: message,
    });
  }
}

function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
