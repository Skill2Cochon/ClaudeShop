/**
 * Reservation entry — a variant + requested qty. Reservations are atomic
 * per-call: either every variant gets the qty or nothing is reserved.
 */
export interface StockReservation {
  variantId: string;
  qty: number;
}

/**
 * Read projection of an inventory row for admin dashboards. Joins the
 * variant + product so the UI can render a single row without a second
 * round-trip per item.
 */
export interface InventoryProjection {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: Record<string, string>;
  sku: string;
  locationId: string;
  onHand: number;
  reserved: number;
  safetyStock: number;
  /** onHand - reserved - safetyStock. Negative = below safety line. */
  available: number;
  updatedAt: string;
}

export interface InventoryListOptions {
  page: number;
  limit: number;
  /** Show only rows where available <= 0 (below safety stock). */
  lowOnly?: boolean;
  /** Show only rows where onHand = 0 (out of stock). */
  outOfStockOnly?: boolean;
}

export interface InventorySummary {
  total: number;
  outOfStock: number;
  lowStock: number;
  healthy: number;
}

export interface AdjustStockInput {
  variantId: string;
  /** Positive = receive, negative = shrinkage / manual decrement. */
  delta: number;
  /** Optional note for the audit trail. */
  reason?: string;
}

export interface SetSafetyStockInput {
  variantId: string;
  safetyStock: number;
}

export interface InventoryRepository {
  /**
   * Atomically reserve stock for every variant. Implementation MUST use a
   * single transaction with conditional updates so a concurrent buyer can't
   * race us. Throws InventoryError when any variant lacks stock —
   * no partial reservations.
   */
  reserveStock(tenantId: string, reservations: StockReservation[]): Promise<void>;

  /**
   * Release a prior reservation. Called on order cancellation, payment
   * timeout, or failed capture. Idempotent at the repository layer:
   * releasing past zero is clamped to zero.
   */
  releaseStock(tenantId: string, releases: StockReservation[]): Promise<void>;

  /**
   * Convert reserved stock into committed (shipped) inventory. Called
   * when an order moves to SHIPPED. Decrements `onHand` and `reserved`
   * by the same qty (net-zero to availability).
   */
  commitReservation(tenantId: string, commits: StockReservation[]): Promise<void>;

  /**
   * Increment on-hand stock for one or more variants — used by PO reception
   * and manual adjustments. Upserts an InventoryItem row at the default
   * location when none exists.
   */
  incrementOnHand(tenantId: string, increments: StockReservation[]): Promise<void>;

  /**
   * Read projection for admin dashboards. Returns tenant-scoped inventory
   * rows joined with variant + product metadata. Supports pagination +
   * low-stock / out-of-stock filters.
   */
  listProjections(
    tenantId: string,
    opts: InventoryListOptions,
  ): Promise<{ items: InventoryProjection[]; total: number }>;

  /**
   * Cheap count query for the inventory KPI strip. One SQL query; callers
   * should not assume perfect atomicity with listProjections.
   */
  summary(tenantId: string): Promise<InventorySummary>;

  /**
   * Apply a manual stock adjustment (receipt / shrinkage). Positive delta
   * increments onHand, negative delta decrements. Never touches `reserved`.
   */
  adjustStock(tenantId: string, input: AdjustStockInput): Promise<void>;

  /** Set the safety-stock threshold on a variant's default location. */
  setSafetyStock(tenantId: string, input: SetSafetyStockInput): Promise<void>;
}
