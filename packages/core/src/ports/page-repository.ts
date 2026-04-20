import type {
  CreatePageInput,
  Page,
  PageStatus,
  UpdatePageInput,
} from '@claudeshop/contracts/page';

export interface PageRepository {
  findById(tenantId: string, id: string): Promise<Page | null>;
  findBySlug(tenantId: string, slug: string): Promise<Page | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PageStatus },
  ): Promise<{ items: Page[]; total: number }>;
  create(
    tenantId: string,
    input: CreatePageInput & { publishedAt?: Date },
  ): Promise<Page>;
  update(tenantId: string, id: string, input: UpdatePageInput): Promise<Page>;
  delete(tenantId: string, id: string): Promise<void>;
}
