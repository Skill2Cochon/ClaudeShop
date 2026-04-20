import { z } from 'zod';
import { CuidSchema, MoneySchema } from '@claudeshop/contracts/common';
import type { Order } from '@claudeshop/contracts/order';
import { InventoryError, NotFoundError, PaymentError, ValidationError } from '@claudeshop/errors';
import type { InventoryRepository, StockReservation } from '../ports/inventory-repository.js';
import type { OrderRepository } from '../ports/order-repository.js';
import type { PaymentProvider } from '../ports/payment-provider.js';

export const RefundReasonSchema = z.enum([
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'other',
]);

export const RefundPaymentInputSchema = z.object({
  orderId: CuidSchema,
  /** Partial refund amount. Omit for full refund of order.totals.total. */
  amount: MoneySchema.optional(),
  reason: RefundReasonSchema.optional(),
  providerRef: z.string().min(4).optional(),
});
export type RefundPaymentInput = z.infer<typeof RefundPaymentInputSchema>;

export interface RefundPaymentResult {
  orderId: string;
  orderNumber: string;
  refundId: string;
  amount: string;
  currency: string;
  isFullRefund: boolean;
}

export interface RefundPaymentDeps {
  tenantId: string;
  orderRepo: OrderRepository;
  paymentProvider: PaymentProvider;
  /**
   * Optional — when provided, a FULL refund releases reserved stock back to
   * the pool (for orders that were reserved but never shipped). For orders
   * that already shipped, inventory commits happened and nothing is restored.
   */
  inventoryRepo?: InventoryRepository;
  /** Monotonic counter for refund idempotency keys (defaults to Date.now). */
  sequence?: () => Promise<number>;
}

/**
 * Refund a captured payment.
 *
 * Contract:
 * - Order must be PAID, FULFILLING, SHIPPED, or DELIVERED.
 * - `providerRef` must be provided (resolved by the route from the Payment row).
 * - Partial refund: order status unchanged (PAID / etc remain).
 * - Full refund: order transitions to REFUNDED.
 * - Idempotency key = `order:${orderId}:refund:${sequence}` — safe to retry.
 *
 * Errors:
 * - ValidationError — bad input, refund exceeds order total
 * - NotFoundError   — order not in tenant scope
 * - PaymentError    — order status invalid, provider rejection, missing ref
 */
export async function refundPayment(
  input: RefundPaymentInput,
  deps: RefundPaymentDeps,
): Promise<RefundPaymentResult> {
  const parsed = RefundPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid refundPayment input', { details: parsed.error.issues });
  }
  if (!parsed.data.providerRef) {
    throw new ValidationError('providerRef is required');
  }

  const order: Order | null = await deps.orderRepo.findById(
    deps.tenantId,
    parsed.data.orderId,
  );
  if (!order) throw new NotFoundError(`Order ${parsed.data.orderId} not found`);

  const refundable = new Set<Order['status']>([
    'PAID',
    'FULFILLING',
    'SHIPPED',
    'DELIVERED',
  ]);
  if (!refundable.has(order.status)) {
    throw new PaymentError(
      `Order status ${order.status} cannot be refunded (must be one of PAID, FULFILLING, SHIPPED, DELIVERED)`,
      { details: { orderId: order.id, currentStatus: order.status } },
    );
  }

  const refundAmount = parsed.data.amount ?? order.totals.total;
  if (compareAmount(refundAmount, order.totals.total) > 0) {
    throw new ValidationError(
      `Refund amount ${refundAmount} exceeds order total ${order.totals.total}`,
      { details: { requested: refundAmount, orderTotal: order.totals.total } },
    );
  }

  const seq = deps.sequence ? await deps.sequence() : Date.now();
  const idempotencyKey = `order:${order.id}:refund:${seq}`;

  const refund = await deps.paymentProvider.refund(
    {
      providerRef: parsed.data.providerRef,
      amount: refundAmount,
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      metadata: { orderId: order.id, tenantId: deps.tenantId, orderNumber: order.number },
    },
    idempotencyKey,
  );

  const isFullRefund = compareAmount(refundAmount, order.totals.total) === 0;

  if (isFullRefund) {
    await deps.orderRepo.updateStatus(deps.tenantId, order.id, 'REFUNDED');

    // Best-effort stock release for orders not yet shipped. Shipped orders
    // had their stock committed, so nothing to release.
    if (
      deps.inventoryRepo &&
      (order.status === 'PAID' || order.status === 'FULFILLING')
    ) {
      const releases: StockReservation[] = order.lines.map((l) => ({
        variantId: l.variantId,
        qty: l.qty,
      }));
      try {
        await deps.inventoryRepo.releaseStock(deps.tenantId, releases);
      } catch (err) {
        if (err instanceof InventoryError) {
          // Non-fatal: refund already committed at PSP. Log via caller.
        } else {
          throw err;
        }
      }
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.number,
    refundId: refund.refundId,
    amount: refund.amount,
    currency: refund.currency,
    isFullRefund,
  };
}

/** Compare two decimal strings. Returns -1, 0, 1. */
function compareAmount(a: string, b: string): number {
  const aCents = toCents(a);
  const bCents = toCents(b);
  if (aCents < bCents) return -1;
  if (aCents > bCents) return 1;
  return 0;
}

function toCents(value: string): bigint {
  const [sign, rest] = value.startsWith('-') ? [-1n, value.slice(1)] : [1n, value];
  const [whole, frac = ''] = rest.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return sign * (BigInt(whole ?? '0') * 100n + BigInt(fracPadded || '0'));
}
