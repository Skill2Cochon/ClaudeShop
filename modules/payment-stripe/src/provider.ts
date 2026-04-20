import Stripe from 'stripe';
import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProvider,
  PaymentProviderEvent,
  RefundInput,
  RefundResult,
} from '@claudeshop/core';
import { PaymentError } from '@claudeshop/errors';
import type { StripeModuleSettings } from './settings';

/**
 * Stripe PaymentProvider adapter.
 *
 * - `createIntent` calls the live PaymentIntents API with an Idempotency-Key
 *   (Stripe's native header — caller passes the same key used at our own
 *   Idempotency plugin layer).
 * - `verifyWebhook` uses `stripe.webhooks.constructEvent` which performs
 *   constant-time HMAC SHA-256 against the raw body. Invalid signatures
 *   return null; valid events are mapped to our typed `PaymentProviderEvent`.
 *
 * Deferred to Phase 2.6:
 * - Automatic replay protection via a processed-events table (currently
 *   relies on Stripe's built-in retry semantics — same event.id is fine
 *   because downstream updateStatus is idempotent).
 * - 3-D Secure / SCA flow (handled by Stripe Elements client-side).
 * - Multi-currency + connected accounts routing.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  private readonly client: Stripe;

  constructor(private readonly settings: StripeModuleSettings) {
    this.client = new Stripe(settings.secretKey, {
      // Pinned to the SDK's default; bump after manual release-notes review.
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 15_000,
    });
  }

  async createIntent(
    input: CreateIntentInput,
    idempotencyKey: string,
  ): Promise<CreateIntentResult> {
    const amountCents = toCents(input.amount);
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: amountCents,
          currency: input.currency.toLowerCase(),
          metadata: {
            orderId: input.orderId,
            tenantId: input.tenantId,
            ...(input.metadata ?? {}),
          },
          ...(input.customerEmail ? { receipt_email: input.customerEmail } : {}),
          ...(this.settings.automaticPaymentMethods
            ? { automatic_payment_methods: { enabled: true } }
            : {}),
        },
        {
          idempotencyKey,
          ...(this.settings.accountId ? { stripeAccount: this.settings.accountId } : {}),
        },
      );

      if (!intent.client_secret) {
        throw new PaymentError('Stripe returned a PaymentIntent without client_secret', {
          details: { intentId: intent.id },
        });
      }

      return {
        providerRef: intent.id,
        clientSecret: intent.client_secret,
        status: mapIntentStatus(intent.status),
      };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        throw new PaymentError(`Stripe rejected the intent: ${err.message}`, {
          details: { code: err.code, type: err.type },
          cause: err,
        });
      }
      throw err;
    }
  }

  async refund(input: RefundInput, idempotencyKey: string): Promise<RefundResult> {
    try {
      // Stripe only accepts a fixed set of reasons; "other" maps to no reason.
      const stripeReason =
        input.reason === 'duplicate' ||
        input.reason === 'fraudulent' ||
        input.reason === 'requested_by_customer'
          ? input.reason
          : undefined;

      const refund = await this.client.refunds.create(
        {
          payment_intent: input.providerRef,
          ...(input.amount ? { amount: Math.round(Number.parseFloat(input.amount) * 100) } : {}),
          ...(stripeReason ? { reason: stripeReason } : {}),
          metadata: input.metadata,
        },
        {
          idempotencyKey,
          ...(this.settings.accountId ? { stripeAccount: this.settings.accountId } : {}),
        },
      );

      return {
        refundId: refund.id,
        amount: (refund.amount / 100).toFixed(2),
        currency: refund.currency.toUpperCase(),
        status: mapRefundStatus(refund.status),
      };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        throw new PaymentError(`Stripe refund rejected: ${err.message}`, {
          details: { code: err.code, type: err.type },
          cause: err,
        });
      }
      throw err;
    }
  }

  async verifyWebhook(
    payload: string | Buffer,
    signature: string,
  ): Promise<PaymentProviderEvent | null> {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(
        payload,
        signature,
        this.settings.webhookSecret,
      );
    } catch {
      return null; // Invalid signature — do NOT leak details to caller.
    }

    return mapEvent(event);
  }
}

/** Stripe Refund.status → our RefundResult.status. */
function mapRefundStatus(
  status: string | null | undefined,
): 'PENDING' | 'SUCCEEDED' | 'FAILED' {
  switch (status) {
    case 'pending':
    case 'requires_action':
      return 'PENDING';
    case 'succeeded':
      return 'SUCCEEDED';
    case 'failed':
    case 'canceled':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/** Stripe PaymentIntent.status → our PaymentStatus enum. */
function mapIntentStatus(status: Stripe.PaymentIntent.Status): 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' {
  switch (status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
      return 'PENDING';
    case 'requires_capture':
      return 'AUTHORIZED';
    case 'succeeded':
      return 'CAPTURED';
    case 'canceled':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

function mapEvent(event: Stripe.Event): PaymentProviderEvent | null {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: 'payment.succeeded',
        orderId: pi.metadata?.orderId ?? '',
        providerRef: pi.id,
        amount: fromCents(pi.amount_received ?? pi.amount),
        currency: pi.currency.toUpperCase(),
      };
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: 'payment.failed',
        orderId: pi.metadata?.orderId ?? '',
        providerRef: pi.id,
        reason: pi.last_payment_error?.message ?? 'Unknown failure',
      };
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      return {
        type: 'payment.refunded',
        orderId: charge.metadata?.orderId ?? '',
        providerRef: charge.payment_intent as string,
        amount: fromCents(charge.amount_refunded),
      };
    }
    default:
      // Unhandled event type — ignore silently (Stripe retries on non-2xx).
      return null;
  }
}

/** "29.90" → 2990 (cents). */
function toCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new PaymentError(`Invalid amount: ${value}`);
  }
  return Math.round(parsed * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
