import type {
  CreateTaxRateInput,
  TaxRate,
  UpdateTaxRateInput,
} from '@claudeshop/contracts/checkout';

export interface TaxRateRepository {
  findById(tenantId: string, id: string): Promise<TaxRate | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean; countryCode?: string },
  ): Promise<{ items: TaxRate[]; total: number }>;
  create(tenantId: string, input: CreateTaxRateInput): Promise<TaxRate>;
  update(tenantId: string, id: string, input: UpdateTaxRateInput): Promise<TaxRate>;
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * Find ACTIVE tax rates whose country (and optional region/postcode) match
   * the destination, ordered by priority DESC. Caller picks the first hit.
   */
  findApplicable(
    tenantId: string,
    address: { country: string; region?: string; postcode?: string },
  ): Promise<TaxRate[]>;
}
