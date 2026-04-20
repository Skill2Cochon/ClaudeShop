export interface WishlistEntry {
  productId: string;
  createdAt: string;
}

/**
 * Wishlist lives in the customer's identity scope — one row per
 * (tenantId, customerId, productId). The port is deliberately narrow: the
 * storefront only needs toggle + list + isFavourited flags.
 */
export interface WishlistRepository {
  list(
    tenantId: string,
    customerId: string,
  ): Promise<WishlistEntry[]>;

  /**
   * Returns true when the product was added, false when it was already
   * favourited and got removed instead. The caller can use that to decide
   * which icon to render.
   */
  toggle(
    tenantId: string,
    customerId: string,
    productId: string,
  ): Promise<{ favourited: boolean }>;

  /** Fast existence check — used by PDP to render the heart state. */
  isFavourited(
    tenantId: string,
    customerId: string,
    productId: string,
  ): Promise<boolean>;
}
