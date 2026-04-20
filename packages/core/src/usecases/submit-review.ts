import {
  CreateReviewInputSchema,
  type CreateReviewInput,
  type Review,
} from '@claudeshop/contracts/review';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository.js';
import type { ReviewRepository } from '../ports/review-repository.js';

export interface SubmitReviewDeps {
  tenantId: string;
  productRepo: ProductRepository;
  reviewRepo: ReviewRepository;
}

/**
 * Customer-submitted review. Goes into PENDING by default; admin moderates
 * via moderateReview. Re-submitting from /account replaces the prior text
 * (upsert keyed on tenantId + productId + authorName).
 */
export async function submitReview(
  input: CreateReviewInput,
  deps: SubmitReviewDeps,
): Promise<Review> {
  const parsed = CreateReviewInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid review input', { details: parsed.error.issues });
  }

  const product = await deps.productRepo.findById(deps.tenantId, parsed.data.productId);
  if (!product) {
    throw new NotFoundError(`Product ${parsed.data.productId} not found`);
  }
  if (product.status !== 'ACTIVE') {
    throw new ValidationError(`Reviews are closed for ${product.status} products`);
  }

  return deps.reviewRepo.upsert(deps.tenantId, parsed.data);
}

export interface ModerateReviewDeps {
  tenantId: string;
  reviewRepo: ReviewRepository;
  /** Used to stamp `approvedAt` when status flips to APPROVED. */
  now: () => Date;
}

/**
 * Admin-side decision: APPROVED makes the review storefront-visible (and
 * stamps approvedAt); REJECTED hides it; PENDING reverts.
 */
export async function moderateReview(
  reviewId: string,
  status: 'APPROVED' | 'REJECTED' | 'PENDING',
  deps: ModerateReviewDeps,
): Promise<Review> {
  const existing = await deps.reviewRepo.findById(deps.tenantId, reviewId);
  if (!existing) throw new NotFoundError(`Review ${reviewId} not found`);
  const approvedAt = status === 'APPROVED' ? deps.now() : null;
  return deps.reviewRepo.setStatus(deps.tenantId, reviewId, status, approvedAt);
}
