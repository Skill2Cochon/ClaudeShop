import type { Payment, PaymentStatus } from '@claudeshop/contracts/order';

export interface CreatePaymentInput {
  tenantId: string;
  orderId: string;
  provider: string;
  providerRef: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentRepository {
  findById(tenantId: string, id: string): Promise<Payment | null>;

  /**
   * Look up the Payment row by the provider's reference (e.g. Stripe
   * PaymentIntent id). Tenant-scoped. Returns null when no row matches.
   * Used by the webhook handler to resolve `providerRef → orderId` on
   * payment.succeeded / refunded events.
   */
  findByProviderRef(
    tenantId: string,
    provider: string,
    providerRef: string,
  ): Promise<Payment | null>;

  /**
   * Returns the most recent non-failed Payment row for an order. Used by
   * the refund route to auto-resolve providerRef instead of asking the
   * admin to paste it.
   */
  findLatestForOrder(tenantId: string, orderId: string): Promise<Payment | null>;

  /** List all payments for an order (refund history + retries). */
  listByOrder(tenantId: string, orderId: string): Promise<Payment[]>;

  /**
   * Create a Payment row. `idempotencyKey` is UNIQUE at the DB level so
   * retries with the same key yield the existing row instead of a
   * duplicate. Implementations SHOULD upsert on (tenantId, idempotencyKey).
   */
  create(input: CreatePaymentInput): Promise<Payment>;

  /**
   * Update the status of an existing Payment row. Called by the webhook
   * handler after the PSP confirms AUTHORIZED / CAPTURED / FAILED /
   * REFUNDED.
   */
  updateStatus(
    tenantId: string,
    id: string,
    status: PaymentStatus,
    capturedAt?: Date,
  ): Promise<Payment>;
}
