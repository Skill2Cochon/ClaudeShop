import type { PaymentStatus } from '@claudeshop/contracts/order';

export interface CreateIntentInput {
  orderId: string;
  tenantId: string;
  amount: string; // decimal "29.90"
  currency: string; // ISO 4217, e.g. "EUR"
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface CreateIntentResult {
  /** Provider-specific identifier (e.g. "pi_123..." for Stripe). */
  providerRef: string;
  /** Secret passed to the client SDK (Stripe Elements, Mollie Components). */
  clientSecret: string;
  /** Status at creation — usually PENDING. */
  status: PaymentStatus;
}

export type PaymentProviderEvent =
  | {
      type: 'payment.succeeded';
      orderId: string;
      providerRef: string;
      amount: string;
      currency: string;
    }
  | {
      type: 'payment.failed';
      orderId: string;
      providerRef: string;
      reason: string;
    }
  | {
      type: 'payment.refunded';
      orderId: string;
      providerRef: string;
      amount: string;
    };

export interface RefundInput {
  providerRef: string;
  /**
   * Refund amount in the order's currency. Omit for full refund.
   */
  amount?: string;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';
  metadata?: Record<string, string>;
}

export interface RefundResult {
  /** Provider-assigned refund id (e.g. "re_..." for Stripe). */
  refundId: string;
  /** Refunded amount actually processed by the PSP. */
  amount: string;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

/**
 * Pluggable payment provider. Providers include Stripe (first-party),
 * Mollie, Adyen (Phase 3+). Each provider is a module (Phase 3) that
 * registers itself via the plugin system.
 */
export interface PaymentProvider {
  /** Provider identifier — "stripe", "mollie", ... */
  readonly name: string;

  /**
   * Create an intent at the PSP and return its client-usable secret.
   * Callers MUST pass an idempotencyKey derived from the order:
   *   idempotencyKey = `order:${orderId}:pay`.
   */
  createIntent(input: CreateIntentInput, idempotencyKey: string): Promise<CreateIntentResult>;

  /**
   * Refund (partially or fully) a captured payment. idempotencyKey prevents
   * duplicate refunds on retry (derived as `order:${orderId}:refund:${n}`).
   */
  refund(input: RefundInput, idempotencyKey: string): Promise<RefundResult>;

  /**
   * Verify the signature + body of an incoming webhook and return a typed
   * event (or null if the signature is invalid). Implementations MUST
   * reject replayed events (same provider ref already processed).
   */
  verifyWebhook(
    payload: string | Buffer,
    signature: string,
  ): Promise<PaymentProviderEvent | null>;
}
