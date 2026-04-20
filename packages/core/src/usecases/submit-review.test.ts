import { describe, expect, it, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { Product } from '@claudeshop/contracts/product';
import type {
  CreateReviewInput,
  Review,
  ReviewStatus,
  ReviewSummary,
} from '@claudeshop/contracts/review';
import type { ProductRepository } from '../ports/product-repository.js';
import type { ReviewRepository } from '../ports/review-repository.js';
import { moderateReview, submitReview } from './submit-review.js';

class StubProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();
  seed(p: Product): void {
    this.products.set(p.id, p);
  }
  async findById(tenantId: string, id: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }
  async findBySlug(): Promise<null> {
    return null;
  }
  async list(): Promise<{ items: Product[]; total: number }> {
    return { items: [], total: 0 };
  }
  async create(): Promise<never> {
    throw new Error('not used');
  }
  async update(): Promise<never> {
    throw new Error('not used');
  }
  async archive(): Promise<void> {
    throw new Error('not used');
  }
}

class InMemoryReviewRepo implements ReviewRepository {
  private readonly byKey = new Map<string, Review>();
  private counter = 0;

  async findById(tenantId: string, id: string): Promise<Review | null> {
    for (const r of this.byKey.values()) {
      if (r.id === id && r.tenantId === tenantId) return r;
    }
    return null;
  }
  async listApprovedForProduct(): Promise<{ items: Review[]; total: number }> {
    return { items: [], total: 0 };
  }
  async list(): Promise<{ items: Review[]; total: number }> {
    return { items: [], total: 0 };
  }
  async summaryForProduct(): Promise<ReviewSummary> {
    return { productId: '', count: 0, averageRating: 0, histogram: {} };
  }
  async upsert(tenantId: string, input: CreateReviewInput): Promise<Review> {
    const key = `${tenantId}:${input.productId}:${input.authorName}`;
    const existing = this.byKey.get(key);
    this.counter++;
    const now = new Date().toISOString();
    const next: Review = {
      id: existing?.id ?? `rvw${String(this.counter).padStart(22, '0')}`,
      tenantId,
      productId: input.productId,
      customerId: input.customerId ?? null,
      authUserId: input.authUserId ?? null,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
      authorName: input.authorName,
      status: 'PENDING',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      approvedAt: null,
    };
    this.byKey.set(key, next);
    return next;
  }
  async setStatus(
    _tenantId: string,
    id: string,
    status: ReviewStatus,
    approvedAt: Date | null,
  ): Promise<Review> {
    for (const [k, r] of this.byKey) {
      if (r.id === id) {
        const updated = {
          ...r,
          status,
          approvedAt: approvedAt ? approvedAt.toISOString() : null,
        };
        this.byKey.set(k, updated);
        return updated;
      }
    }
    throw new Error(`not found ${id}`);
  }
  async delete(): Promise<void> {
    /* noop */
  }
}

const tenantId = 'tnt01h0000000000000000000';
const productId = 'cmp01h0000000000000000001';

function makeProduct(status: Product['status'] = 'ACTIVE'): Product {
  const now = new Date().toISOString();
  return {
    id: productId,
    tenantId,
    slug: 'tee',
    status,
    type: 'VARIABLE',
    name: { en: 'Tee' },
    variants: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('submitReview', () => {
  let productRepo: StubProductRepository;
  let reviewRepo: InMemoryReviewRepo;

  beforeEach(() => {
    productRepo = new StubProductRepository();
    reviewRepo = new InMemoryReviewRepo();
    productRepo.seed(makeProduct());
  });

  it('persists a PENDING review with the given fields', async () => {
    const r = await submitReview(
      {
        productId,
        rating: 5,
        title: 'Love it',
        body: 'Comfortable and well made.',
        authorName: 'Alice',
      },
      { tenantId, productRepo, reviewRepo },
    );
    expect(r.status).toBe('PENDING');
    expect(r.rating).toBe(5);
    expect(r.title).toBe('Love it');
    expect(r.authorName).toBe('Alice');
  });

  it('upserts on (tenantId, productId, authorName) — second submit replaces the first and id is preserved', async () => {
    const first = await submitReview(
      { productId, rating: 4, authorName: 'Alice' },
      { tenantId, productRepo, reviewRepo },
    );
    const second = await submitReview(
      { productId, rating: 5, body: 'Updated thoughts.', authorName: 'Alice' },
      { tenantId, productRepo, reviewRepo },
    );
    expect(second.id).toBe(first.id);
    expect(second.rating).toBe(5);
    expect(second.body).toBe('Updated thoughts.');
  });

  it('rejects rating outside 1..5 via Zod', async () => {
    await expect(
      submitReview(
        { productId, rating: 6, authorName: 'Bob' },
        { tenantId, productRepo, reviewRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      submitReview(
        { productId, rating: 0, authorName: 'Bob' },
        { tenantId, productRepo, reviewRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects empty authorName via Zod', async () => {
    await expect(
      submitReview(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { productId, rating: 4, authorName: '' as any },
        { tenantId, productRepo, reviewRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when the product does not exist in the tenant', async () => {
    await expect(
      submitReview(
        {
          productId: 'cmpGHOST00000000000000000',
          rating: 5,
          authorName: 'Alice',
        },
        { tenantId, productRepo, reviewRepo },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses reviews on non-ACTIVE products', async () => {
    productRepo.seed(makeProduct('ARCHIVED'));
    await expect(
      submitReview(
        { productId, rating: 5, authorName: 'Alice' },
        { tenantId, productRepo, reviewRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('moderateReview', () => {
  let productRepo: StubProductRepository;
  let reviewRepo: InMemoryReviewRepo;
  const fixed = new Date('2026-04-19T12:00:00.000Z');
  const now = (): Date => fixed;

  beforeEach(() => {
    productRepo = new StubProductRepository();
    reviewRepo = new InMemoryReviewRepo();
    productRepo.seed(makeProduct());
  });

  it('APPROVED stamps approvedAt and flips status', async () => {
    const r = await submitReview(
      { productId, rating: 5, authorName: 'Alice' },
      { tenantId, productRepo, reviewRepo },
    );
    const moderated = await moderateReview(r.id, 'APPROVED', {
      tenantId,
      reviewRepo,
      now,
    });
    expect(moderated.status).toBe('APPROVED');
    expect(moderated.approvedAt).toBe('2026-04-19T12:00:00.000Z');
  });

  it('REJECTED clears approvedAt', async () => {
    const r = await submitReview(
      { productId, rating: 5, authorName: 'Alice' },
      { tenantId, productRepo, reviewRepo },
    );
    await moderateReview(r.id, 'APPROVED', { tenantId, reviewRepo, now });
    const rejected = await moderateReview(r.id, 'REJECTED', {
      tenantId,
      reviewRepo,
      now,
    });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.approvedAt).toBeNull();
  });

  it('throws NotFoundError when the review does not exist', async () => {
    await expect(
      moderateReview('rvwGHOST000000000000000000', 'APPROVED', {
        tenantId,
        reviewRepo,
        now,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
