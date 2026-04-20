import type {
  CreateCustomerAddressInput,
  CustomerAddress,
  UpdateCustomerAddressInput,
} from '@claudeshop/contracts/customer';

/**
 * Phase 50 — customer-scoped address book. Tenant + customer
 * ownership is checked at the repository layer: list/find/update/
 * remove all require (tenantId, customerId) and the row's
 * customerId is validated on every mutation so a stolen session
 * can't touch another customer's addresses.
 */
export interface CustomerAddressRepository {
  list(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerAddress[]>;

  findById(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddress | null>;

  create(
    tenantId: string,
    customerId: string,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddress>;

  update(
    tenantId: string,
    customerId: string,
    id: string,
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddress>;

  remove(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<void>;

  /**
   * Set a single default address. Clears `isDefault` on all other
   * addresses for the same customer, then marks the chosen one as
   * default. Must be transactional so there's never a "0 default"
   * or "2+ default" window.
   */
  setDefault(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddress>;
}
