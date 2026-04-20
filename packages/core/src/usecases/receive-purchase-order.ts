import {
  ReceivePurchaseOrderInputSchema,
  type PurchaseOrder,
  type ReceivePurchaseOrderInput,
} from '@claudeshop/contracts/erp';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { PurchaseOrderRepository } from '../ports/purchase-order-repository';
import type { InventoryRepository } from '../ports/inventory-repository';
import type { Clock } from '../ports/clock';

export interface ReceivePurchaseOrderDeps {
  tenantId: string;
  repo: PurchaseOrderRepository;
  inventoryRepo: InventoryRepository;
  clock: Clock;
}

/**
 * Receive (fully or partially) a purchase order.
 *
 * Contract:
 * - PO must exist and be SENT or PARTIAL.
 * - Each line referenced must belong to the PO and have remaining qty
 *   (qtyOrdered - qtyReceived >= patch.qty).
 * - On success, InventoryItem.onHand is incremented per variant BEFORE the
 *   PO is updated. We explicitly order these steps so a repo failure
 *   rolling back inventory is an acceptable surface we fail loudly on,
 *   rather than a silent drift between stock and purchase records.
 * - New PO status:
 *     * RECEIVED when every line's qtyReceived == qtyOrdered
 *     * PARTIAL otherwise
 *
 * This is the most correctness-sensitive use-case in the ERP layer — every
 * ticket we cut would start "stock didn't match our orders". Test coverage
 * exists accordingly.
 */
export async function receivePurchaseOrder(
  id: string,
  input: ReceivePurchaseOrderInput,
  deps: ReceivePurchaseOrderDeps,
): Promise<PurchaseOrder> {
  const parsed = ReceivePurchaseOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid receive purchase order input', {
      details: parsed.error.issues,
    });
  }

  const po = await deps.repo.findById(deps.tenantId, id);
  if (!po) throw new NotFoundError(`Purchase order ${id} not found`);
  if (po.status !== 'SENT' && po.status !== 'PARTIAL') {
    throw new ValidationError(
      `Purchase order ${po.number} is ${po.status} — can only receive SENT or PARTIAL orders`,
    );
  }

  // Build a lookup of existing lines + verify every patch is legal.
  const linesById = new Map(po.lines.map((l) => [l.id, l]));
  const mergedByLine = new Map<string, { qty: number; variantId: string }>();
  for (const patch of parsed.data.lines) {
    const line = linesById.get(patch.lineId);
    if (!line) {
      throw new ValidationError(`Line ${patch.lineId} not on purchase order ${po.number}`);
    }
    const prior = mergedByLine.get(patch.lineId);
    const qty = (prior?.qty ?? 0) + patch.qty;
    const alreadyReceived = line.qtyReceived;
    if (qty + alreadyReceived > line.qtyOrdered) {
      throw new ValidationError(
        `Line ${line.sku} would over-receive: ordered ${line.qtyOrdered}, already received ${alreadyReceived}, +${qty}`,
      );
    }
    mergedByLine.set(patch.lineId, { qty, variantId: line.variantId });
  }

  // Group by variant so multiple lines targeting the same variant merge into
  // one onHand increment.
  const incrementsByVariant = new Map<string, number>();
  for (const [, { qty, variantId }] of mergedByLine) {
    incrementsByVariant.set(variantId, (incrementsByVariant.get(variantId) ?? 0) + qty);
  }
  const increments = [...incrementsByVariant.entries()].map(([variantId, qty]) => ({
    variantId,
    qty,
  }));

  await deps.inventoryRepo.incrementOnHand(deps.tenantId, increments);

  const patches = [...mergedByLine.entries()].map(([lineId, { qty }]) => ({
    lineId,
    qty,
  }));
  const updated = await deps.repo.applyReceivedQuantities(deps.tenantId, id, patches);

  const fullyReceived = updated.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
  const nextStatus = fullyReceived ? 'RECEIVED' : 'PARTIAL';
  return deps.repo.updateStatus(deps.tenantId, id, nextStatus, {
    ...(fullyReceived ? { receivedAt: deps.clock.now() } : {}),
  });
}
