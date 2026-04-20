import { z } from 'zod';
import type { Order, OrderStatus } from '@claudeshop/contracts/order';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { OrderRepository } from '../ports/order-repository.js';
import type { InventoryRepository } from '../ports/inventory-repository.js';

export const TransitionOrderStatusInputSchema = z.object({
  orderId: z.string().min(1),
  next: z.enum([
    'DRAFT',
    'PENDING_PAYMENT',
    'PAID',
    'FULFILLING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
});
export type TransitionOrderStatusInput = z.infer<typeof TransitionOrderStatusInputSchema>;

export interface TransitionOrderStatusDeps {
  tenantId: string;
  orderRepo: OrderRepository;
  inventoryRepo: InventoryRepository;
}

/**
 * Valid forward transitions merchants can apply manually from the admin.
 *
 * Money-touching transitions (PENDING_PAYMENT → PAID and anything →
 * REFUNDED) are NOT admin-selectable — they're driven by the payment
 * webhooks + refund flow respectively. We surface them in the enum for
 * completeness but the transition table refuses them here.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['FULFILLING', 'CANCELLED'],
  FULFILLING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Move an order to `next`, enforcing the allowed-transition table so
 * admins can't jump SHIPPED→DRAFT or skip FULFILLING→DELIVERED.
 *
 * Side-effects:
 *  - Transitioning FROM a reserved state (PAID, FULFILLING, SHIPPED) TO
 *    CANCELLED releases the reserved stock. The repo-level release is
 *    idempotent, so repeating the transition is safe.
 *  - SHIPPED commits the reservation into on-hand so inventory reflects
 *    the physical decrement.
 *
 * Throws:
 *  - NotFoundError when the order isn't in the tenant.
 *  - ValidationError when the transition isn't in the whitelist.
 */
export async function transitionOrderStatus(
  input: TransitionOrderStatusInput,
  deps: TransitionOrderStatusDeps,
): Promise<Order> {
  const parsed = TransitionOrderStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid transitionOrderStatus input', {
      details: parsed.error.issues,
    });
  }

  const current = await deps.orderRepo.findById(deps.tenantId, parsed.data.orderId);
  if (!current) {
    throw new NotFoundError(`Order ${parsed.data.orderId} not found`, {
      details: { orderId: parsed.data.orderId, tenantId: deps.tenantId },
    });
  }
  if (current.status === parsed.data.next) return current;

  const allowed = TRANSITIONS[current.status];
  if (!allowed.includes(parsed.data.next)) {
    throw new ValidationError(
      `Illegal transition ${current.status} → ${parsed.data.next}`,
      {
        details: {
          from: current.status,
          to: parsed.data.next,
          allowed,
        },
      },
    );
  }

  // Inventory reconciliation. Reservations land in reserveStock during
  // order placement, so we only have to release or commit on the exit edges.
  const reservations = current.lines.map((line) => ({
    variantId: line.variantId,
    qty: line.qty,
  }));
  const wasReserved =
    current.status === 'PAID' ||
    current.status === 'FULFILLING' ||
    current.status === 'SHIPPED' ||
    current.status === 'PENDING_PAYMENT';

  if (parsed.data.next === 'CANCELLED' && wasReserved) {
    await deps.inventoryRepo.releaseStock(deps.tenantId, reservations);
  }
  if (parsed.data.next === 'SHIPPED') {
    await deps.inventoryRepo.commitReservation(deps.tenantId, reservations);
  }

  return deps.orderRepo.updateStatus(
    deps.tenantId,
    parsed.data.orderId,
    parsed.data.next,
  );
}
