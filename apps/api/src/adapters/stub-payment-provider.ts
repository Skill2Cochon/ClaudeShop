import { randomUUID } from 'node:crypto';
import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProvider,
  PaymentProviderEvent,
  RefundInput,
  RefundResult,
} from '@claudeshop/core';

/**
 * Development-only PaymentProvider that always succeeds. Used when no PSP
 * credentials are configured (NODE_ENV !== 'production' and no STRIPE_*
 * env vars). Returns deterministic refs so the storefront can exercise the
 * full flow without external dependencies.
 *
 * Phase 2.5 ships a real StripePaymentProvider alongside this one; the
 * module system (Phase 3) lets merchants pick between providers per tenant.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';

  async createIntent(
    input: CreateIntentInput,
    idempotencyKey: string,
  ): Promise<CreateIntentResult> {
    const providerRef = `stub_pi_${idempotencyKey.replace(/[:]/g, '_')}_${randomUUID().slice(0, 8)}`;
    return {
      providerRef,
      clientSecret: `stub_secret_${providerRef}`,
      status: 'PENDING',
    };
  }

  async refund(input: RefundInput, idempotencyKey: string): Promise<RefundResult> {
    return {
      refundId: `stub_re_${idempotencyKey.replace(/[:]/g, '_')}_${randomUUID().slice(0, 8)}`,
      amount: input.amount ?? '0.00',
      currency: 'EUR',
      status: 'SUCCEEDED',
    };
  }

  async verifyWebhook(
    _payload: string | Buffer,
    _signature: string,
  ): Promise<PaymentProviderEvent | null> {
    // Stub never receives real webhooks; external callers must POST a
    // trusted event shape directly via /v1/webhooks/stub (dev only).
    return null;
  }
}
