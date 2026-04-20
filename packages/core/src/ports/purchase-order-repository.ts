import type {
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@claudeshop/contracts/erp';

export interface ReceivePurchaseOrderLinePatch {
  lineId: string;
  qty: number;
}

export interface PurchaseOrderRepository {
  findById(tenantId: string, id: string): Promise<PurchaseOrder | null>;
  list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: PurchaseOrderStatus;
      supplierId?: string;
    },
  ): Promise<{ items: PurchaseOrder[]; total: number }>;

  /**
   * Atomically create a PO + its lines. Computes subtotal/total from lines
   * if the caller doesn't pass them; implementations SHOULD do the math in
   * a transaction to keep totals consistent with the stored lines.
   */
  create(
    tenantId: string,
    input: CreatePurchaseOrderInput & { number: string; subtotal: string; total: string },
  ): Promise<PurchaseOrder>;

  updateStatus(
    tenantId: string,
    id: string,
    status: PurchaseOrderStatus,
    opts?: { placedAt?: Date; receivedAt?: Date },
  ): Promise<PurchaseOrder>;

  /**
   * Apply a batch of qty deltas to individual lines (qtyReceived += qty).
   * Caller is responsible for enforcing qtyReceived <= qtyOrdered.
   */
  applyReceivedQuantities(
    tenantId: string,
    id: string,
    patches: ReceivePurchaseOrderLinePatch[],
  ): Promise<PurchaseOrder>;
}
