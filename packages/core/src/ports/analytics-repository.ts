/**
 * Read-only analytics aggregations. Implementations are expected to push
 * the math down to the database (groupBy, aggregate) — never load every
 * order into memory.
 */

export interface RevenueWindow {
  /** ISO date for the bucket (YYYY-MM-DD). */
  date: string;
  /** Money in major units (e.g. "1234.56"). */
  revenue: string;
  orderCount: number;
}

export interface RevenueSummary {
  /** Total revenue across the requested window. */
  total: string;
  /** Total order count across the requested window. */
  orderCount: number;
  /** Currency code — taken from the most recent order. */
  currency: string;
  /** Per-day breakdown, oldest → newest. */
  buckets: RevenueWindow[];
}

export interface TopProductRow {
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  revenue: string;
}

export interface InventoryHealth {
  totalVariants: number;
  /** Variants with onHand <= safetyStock (excluding zero safety stock and zero onHand). */
  lowStockCount: number;
  /** Variants with onHand == 0. */
  outOfStockCount: number;
  /** Variants with onHand > 1000 — useful for surfacing slow-movers. */
  overstockCount: number;
}

export interface OrderStatusBreakdown {
  /** Map status → count over the requested window. */
  counts: Record<string, number>;
  windowDays: number;
}

export interface AnalyticsRepository {
  getRevenueSummary(
    tenantId: string,
    opts: { days: number },
  ): Promise<RevenueSummary>;

  getTopProducts(
    tenantId: string,
    opts: { days: number; limit: number },
  ): Promise<TopProductRow[]>;

  getInventoryHealth(tenantId: string): Promise<InventoryHealth>;

  getOrderStatusBreakdown(
    tenantId: string,
    opts: { days: number },
  ): Promise<OrderStatusBreakdown>;
}
