import type { Order, OrderStatus } from '@claudeshop/contracts/order';

/** Phase 37 — admin-facing filter shape for OrderRepository.list. */
export interface ListOrdersOptions {
  page: number;
  limit: number;
  status?: OrderStatus;
  customerId?: string;
  /** Filter by anonymousEmail — used by storefront /account/orders. */
  customerEmail?: string;
  /** Case-insensitive contains match on the human-readable order number. */
  numberQuery?: string;
  /** Inclusive lower bound on placedAt (falls back to createdAt on drafts). */
  placedFrom?: string;
  /** Inclusive upper bound — the route layer resolves ISO boundaries. */
  placedTo?: string;
}

export interface OrderRepository {
  findById(tenantId: string, id: string): Promise<Order | null>;
  findByNumber(tenantId: string, number: string): Promise<Order | null>;
  list(
    tenantId: string,
    opts: ListOrdersOptions,
  ): Promise<{ items: Order[]; total: number }>;
  create(tenantId: string, order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  updateStatus(tenantId: string, id: string, status: OrderStatus): Promise<Order>;
}
