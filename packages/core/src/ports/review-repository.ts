import type {
  CreateReviewInput,
  Review,
  ReviewStatus,
  ReviewSummary,
} from '@claudeshop/contracts/review';

export interface ReviewRepository {
  findById(tenantId: string, id: string): Promise<Review | null>;
  /**
   * Public-facing list — only APPROVED reviews for the given product, newest
   * first. Pagination built in.
   */
  listApprovedForProduct(
    tenantId: string,
    productId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: Review[]; total: number }>;

  /** Admin moderation queue — filterable by status, all products. */
  list(
    tenantId: string,
    opts: { page: number; limit: number; status?: ReviewStatus; productId?: string },
  ): Promise<{ items: Review[]; total: number }>;

  /**
   * Aggregated summary for a product (count, average, per-star histogram).
   * Used by the storefront PDP header. APPROVED only.
   */
  summaryForProduct(tenantId: string, productId: string): Promise<ReviewSummary>;

  /**
   * Idempotent on (tenantId, productId, authorName): a customer who reviews
   * the same product twice replaces the prior content + reverts to PENDING
   * for re-moderation.
   */
  upsert(tenantId: string, input: CreateReviewInput): Promise<Review>;

  setStatus(
    tenantId: string,
    id: string,
    status: ReviewStatus,
    approvedAt: Date | null,
  ): Promise<Review>;

  delete(tenantId: string, id: string): Promise<void>;
}
