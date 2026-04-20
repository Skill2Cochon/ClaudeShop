import type {
  Customer,
  CreateCustomerInput,
  CustomerGroup,
} from '@claudeshop/contracts/customer';
import type { SegmentRule } from '@claudeshop/contracts/crm';

export interface SegmentMember {
  customerId: string;
  email: string;
}

/** Phase 34 — admin-facing list filters. */
export interface ListCustomersOptions {
  page?: number;
  limit?: number;
  /** Free-text match on email / firstName / lastName (case-insensitive). */
  query?: string;
  /** Narrow to a single commercial group (B2C / B2B / VIP). */
  group?: CustomerGroup;
  /** Narrow to customers that accept marketing opt-in. */
  acceptsMarketing?: boolean;
}

export interface CustomerRepository {
  findById(tenantId: string, id: string): Promise<Customer | null>;
  findByEmail(tenantId: string, email: string): Promise<Customer | null>;
  create(tenantId: string, input: CreateCustomerInput): Promise<Customer>;

  /**
   * Phase 34 — paginated admin customer directory. Keeps the surface small
   * and consistent with segments/orders: {items, total}. A `query` string
   * does a case-insensitive contains match across email/firstName/lastName
   * so a merchant can jump to a customer by any of the three without
   * building a dedicated search index.
   */
  list(
    tenantId: string,
    opts: ListCustomersOptions,
  ): Promise<{ items: Customer[]; total: number }>;

  /**
   * Phase 11 — return customers that match the segment rules. Pure read,
   * intended to be called by computeSegmentMembers + sendEmailCampaign.
   * Pagination is built in so a 100k-customer segment doesn't load
   * everything at once during a campaign send.
   */
  findSegmentMembers(
    tenantId: string,
    rules: SegmentRule,
    opts?: { page?: number; limit?: number },
  ): Promise<{ items: SegmentMember[]; total: number }>;
}
