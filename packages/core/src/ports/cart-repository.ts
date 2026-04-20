import type { Cart, CartItem } from '@claudeshop/contracts/cart';

export interface CartRepository {
  findById(tenantId: string, id: string): Promise<Cart | null>;

  /**
   * Find the most recent ACTIVE cart for a customer (logged-in) or an
   * anonymous session token. Returns null if none exists.
   */
  findActiveCart(
    tenantId: string,
    ref: { customerId?: string; anonymousId?: string; currency: string },
  ): Promise<Cart | null>;

  create(
    tenantId: string,
    data: {
      currency: string;
      customerId?: string;
      anonymousId?: string;
    },
  ): Promise<Cart>;

  /**
   * Add an item to the cart. If the variant is already present, increment
   * the qty by `qty`. Repository is responsible for returning the canonical
   * cart (with all items, re-ordered by createdAt).
   */
  addItem(
    tenantId: string,
    cartId: string,
    item: { variantId: string; qty: number; unitPrice: string },
  ): Promise<Cart>;

  /** Update an existing line — if qty is 0, remove the line. */
  updateItemQty(tenantId: string, cartId: string, itemId: string, qty: number): Promise<Cart>;

  removeItem(tenantId: string, cartId: string, itemId: string): Promise<Cart>;

  /** Fetch the items of a cart — used by checkout. */
  getItems(tenantId: string, cartId: string): Promise<CartItem[]>;

  /**
   * Transition an ACTIVE cart to ORDERED once an order has been created from it.
   * Idempotent: calling on an already-ORDERED cart is a no-op, not an error.
   */
  markOrdered(tenantId: string, cartId: string): Promise<Cart>;
}
