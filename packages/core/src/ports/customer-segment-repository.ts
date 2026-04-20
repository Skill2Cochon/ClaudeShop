import type {
  CreateSegmentInput,
  CustomerSegment,
  UpdateSegmentInput,
} from '@claudeshop/contracts/crm';

export interface CustomerSegmentRepository {
  findById(tenantId: string, id: string): Promise<CustomerSegment | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: CustomerSegment[]; total: number }>;
  create(tenantId: string, input: CreateSegmentInput): Promise<CustomerSegment>;
  update(
    tenantId: string,
    id: string,
    input: UpdateSegmentInput,
  ): Promise<CustomerSegment>;
  delete(tenantId: string, id: string): Promise<void>;

  /** Persist the recomputed customer count + refreshedAt for one segment. */
  setCount(
    tenantId: string,
    id: string,
    count: number,
    refreshedAt: Date,
  ): Promise<CustomerSegment>;
}
