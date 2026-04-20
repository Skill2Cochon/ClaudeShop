import { createHmac } from 'node:crypto';
import type { WebhookDelivery } from '@claudeshop/contracts/webhook';
import type { HttpClient } from '../ports/http-client.js';
import type { WebhookDeliveryRepository } from '../ports/webhook-delivery-repository.js';
import type { WebhookSubscriptionRepository } from '../ports/webhook-subscription-repository.js';
import type { Clock } from '../ports/clock.js';

export interface DispatchWebhookEventInput {
  /** Topic name — e.g. "order.placed" or "payment.captured". */
  eventType: string;
  /**
   * Stable id for this event. Used as the upsert key on (subscriptionId,
   * eventId) so retries don't double-deliver. Typically `${entity}:${id}`
   * (e.g. "order:cmp01h…").
   */
  eventId: string;
  /** JSON-serialisable payload. The full body is HMAC-signed. */
  payload: unknown;
}

export interface DispatchWebhookEventDeps {
  tenantId: string;
  subscriptionRepo: WebhookSubscriptionRepository;
  deliveryRepo: WebhookDeliveryRepository;
  http: HttpClient;
  clock: Clock;
  /** Per-attempt timeout passed to the HTTP client. */
  timeoutMs?: number;
}

export interface DispatchWebhookEventResult {
  eventType: string;
  eventId: string;
  fanout: number;
  deliveries: WebhookDelivery[];
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fan an event out to every active subscription that asked for this topic.
 *
 * Phase 14 contract:
 * - Idempotent per (subscription, eventId): repeated dispatches reuse the
 *   existing delivery row so we never double-POST.
 * - Already-DELIVERED rows are skipped (returned as-is). PENDING/FAILED
 *   are retried.
 * - HTTP errors (network, non-2xx) flip the row to FAILED with the response
 *   body recorded; retry policy lives outside this use-case (cron sweeper
 *   in Phase 14.1).
 * - HMAC signing uses sha256 over the exact body string. Header is
 *   `X-ClaudeShop-Signature: sha256=<hex>` plus `X-ClaudeShop-Event` and
 *   `X-ClaudeShop-Delivery` for traceability.
 */
export async function dispatchWebhookEvent(
  input: DispatchWebhookEventInput,
  deps: DispatchWebhookEventDeps,
): Promise<DispatchWebhookEventResult> {
  const subs = await deps.subscriptionRepo.findActiveForEvent(
    deps.tenantId,
    input.eventType,
  );
  if (subs.length === 0) {
    return {
      eventType: input.eventType,
      eventId: input.eventId,
      fanout: 0,
      deliveries: [],
    };
  }

  const body = JSON.stringify({
    eventType: input.eventType,
    eventId: input.eventId,
    tenantId: deps.tenantId,
    occurredAt: deps.clock.nowIso(),
    payload: input.payload,
  });

  const deliveries: WebhookDelivery[] = [];

  for (const sub of subs) {
    const upsert = await deps.deliveryRepo.upsert(deps.tenantId, {
      subscriptionId: sub.id,
      eventType: input.eventType,
      eventId: input.eventId,
      payload: input.payload,
    });
    if (!upsert.isNew && upsert.delivery.status === 'DELIVERED') {
      deliveries.push(upsert.delivery);
      continue;
    }

    const signature = signBody(sub.secret, body);
    const attemptedAt = deps.clock.now();
    try {
      const response = await deps.http.send({
        url: sub.url,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-claudeshop-event': input.eventType,
          'x-claudeshop-delivery': upsert.delivery.id,
          'x-claudeshop-signature': `sha256=${signature}`,
        },
        body,
        timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
      const delivered = response.status >= 200 && response.status < 300;
      const finalised = await deps.deliveryRepo.recordAttempt(
        deps.tenantId,
        upsert.delivery.id,
        {
          status: delivered ? 'DELIVERED' : 'FAILED',
          responseStatus: response.status,
          responseBody: response.body.slice(0, 4_000),
          attemptedAt,
          ...(delivered ? { deliveredAt: attemptedAt } : {}),
          ...(delivered
            ? {}
            : { errorMessage: `HTTP ${response.status}` }),
        },
      );
      deliveries.push(finalised);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const finalised = await deps.deliveryRepo.recordAttempt(
        deps.tenantId,
        upsert.delivery.id,
        {
          status: 'FAILED',
          attemptedAt,
          errorMessage: message,
        },
      );
      deliveries.push(finalised);
    }
  }

  return {
    eventType: input.eventType,
    eventId: input.eventId,
    fanout: subs.length,
    deliveries,
  };
}

function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}
