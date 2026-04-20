import type { PriceSet, Variant } from '@claudeshop/contracts/product';

/** Admin-edit payload for upserting a per-variant price set. */
export interface UpsertPriceSetInput {
  currency: string;
  amount: string;
  channel?: string;
  validFrom?: string | null;
  validTo?: string | null;
  taxIncluded?: boolean;
}

/**
 * Compact summary used when rendering order / cart lines.
 * `productName` is a single resolved string (not a locale map) because the
 * caller has already picked a locale or the repository defaults to the tenant
 * default locale.
 */
export interface VariantSummary {
  variantId: string;
  sku: string;
  productName: string;
}

export interface VariantRepository {
  findById(tenantId: string, variantId: string): Promise<Variant | null>;

  /**
   * Resolve a minimal display tuple {sku, productName} for a variant.
   * Used by placeOrder to populate OrderLine.sku / productName without a
   * full product fetch. Returns null if the variant is not in the tenant.
   */
  getSummary(tenantId: string, variantId: string): Promise<VariantSummary | null>;

  /**
   * Resolve the active price for a variant in a given currency + channel.
   * Returns null if no price set matches (caller should throw NotFoundError).
   *
   * Business rule: the "active" price is the one where
   *   validFrom <= now AND (validTo IS NULL OR validTo > now).
   */
  getPriceFor(
    tenantId: string,
    variantId: string,
    opts: { currency: string; channel?: string },
  ): Promise<string | null>;

  /**
   * Available stock across all locations for a given variant, minus reserved.
   * Returns 0 if no inventory row exists (defensive default).
   */
  getAvailableStock(tenantId: string, variantId: string): Promise<number>;

  // --- Admin pricing surface (Phase 30) ------------------------------------

  /** List every PriceSet attached to a variant, newest-first by channel. */
  listPrices(tenantId: string, variantId: string): Promise<PriceSet[]>;

  /**
   * Create-or-update the PriceSet for (variant, currency, channel). The
   * unique key on the table means we can express this as an upsert; the
   * caller decides whether to set validity windows.
   */
  upsertPrice(
    tenantId: string,
    variantId: string,
    input: UpsertPriceSetInput,
  ): Promise<PriceSet>;

  /** Remove the PriceSet for (variant, currency, channel). Noop if absent. */
  deletePrice(
    tenantId: string,
    variantId: string,
    opts: { currency: string; channel?: string },
  ): Promise<void>;
}
