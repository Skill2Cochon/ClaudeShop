import type {
  CreateShippingRateInput,
  ShippingRate,
  UpdateShippingRateInput,
} from '@claudeshop/contracts/checkout';

export interface ShippingRateRepository {
  findById(tenantId: string, id: string): Promise<ShippingRate | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean },
  ): Promise<{ items: ShippingRate[]; total: number }>;
  create(tenantId: string, input: CreateShippingRateInput): Promise<ShippingRate>;
  update(tenantId: string, id: string, input: UpdateShippingRateInput): Promise<ShippingRate>;
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * Find ACTIVE shipping rates that ship to the given country, currency
   * matches, and basket subtotal meets minSubtotalCents. Sorted by base
   * price ASC so the cart can show the cheapest first.
   */
  findApplicable(
    tenantId: string,
    opts: { country: string; currency: string; subtotalCents: number },
  ): Promise<ShippingRate[]>;
}
