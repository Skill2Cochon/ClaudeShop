import { z } from 'zod';
import { CuidSchema } from '@claudeshop/contracts/common';
import type { Order } from '@claudeshop/contracts/order';
import { NotFoundError, PaymentError, ValidationError } from '@claudeshop/errors';
import type { OrderRepository } from '../ports/order-repository.js';
import type { PaymentProvider } from '../ports/payment-provider.js';
import type { PaymentRepository } from '../ports/payment-repository.js';

export const CreatePaymentIntentInputSchema = z.object({
  orderId: CuidSchema,
});
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentInputSchema>;

export interface CreatePaymentIntentResult {
  orderId: string;
  orderNumber: string;
  providerRef: string;
  clientSecret: string;
  amount: string;
  currency: string;
}

export interface CreatePaymentIntentDeps {
  tenantId: string;
  orderRepo: OrderRepository;
  paymentProvider: PaymentProvider;
  /**
   * When provided, the created intent is persisted as a Payment row so
   * refunds + webhooks can resolve providerRef → orderId without round-
   * tripping to the PSP.
   */
  paymentRepo?: PaymentRepository;
}

/**
 * Create a payment intent at the configured PSP for a PENDING_PAYMENT order.
 *
 * Contract:
 * - Validate input.
 * - Load order; must exist and be PENDING_PAYMENT.
 * - Call provider.createIntent with idempotencyKey = `order:${orderId}:pay`.
 *   Provider guarantees idempotency at its layer — retrying yields the same
 *   intent, not duplicates.
 * - Return the client secret for the storefront to finalize (Stripe Elements,
 *   Mollie Components, etc.).
 *
 * Errors:
 * - ValidationError — bad input
 * - NotFoundError   — order not in tenant scope
 * - PaymentError    — order status invalid OR provider rejection
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
  deps: CreatePaymentIntentDeps,
): Promise<CreatePaymentIntentResult> {
  const parsed = CreatePaymentIntentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid createPaymentIntent input', {
      details: parsed.error.issues,
    });
  }

  const order: Order | null = await deps.orderRepo.findById(
    deps.tenantId,
    parsed.data.orderId,
  );
  if (!order) throw new NotFoundError(`Order ${parsed.data.orderId} not found`);

  if (order.status !== 'PENDING_PAYMENT') {
    throw new PaymentError(
      `Order status must be PENDING_PAYMENT to create a payment intent (was: ${order.status})`,
      { details: { orderId: order.id, currentStatus: order.status } },
    );
  }

  const idempotencyKey = `order:${order.id}:pay`;

  const intent = await deps.paymentProvider.createIntent(
    {
      orderId: order.id,
      tenantId: deps.tenantId,
      amount: order.totals.total,
      currency: order.currency,
      ...(order.anonymousEmail ? { customerEmail: order.anonymousEmail } : {}),
      metadata: {
        orderNumber: order.number,
        tenantId: deps.tenantId,
      },
    },
    idempotencyKey,
  );

  if (deps.paymentRepo) {
    await deps.paymentRepo.create({
      tenantId: deps.tenantId,
      orderId: order.id,
      provider: deps.paymentProvider.name,
      providerRef: intent.providerRef,
      status: intent.status,
      amount: order.totals.total,
      currency: order.currency,
      idempotencyKey,
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.number,
    providerRef: intent.providerRef,
    clientSecret: intent.clientSecret,
    amount: order.totals.total,
    currency: order.currency,
  };
}
