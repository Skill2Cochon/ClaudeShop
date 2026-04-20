import type {
  CreateReviewInput,
  Review,
  ReviewStatus,
  ReviewSummary,
} from '@claudeshop/contracts/review';
import type { ReviewRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  productId: string;
  customerId: string | null;
  authUserId: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
};

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async listApprovedForProduct(
    tenantId: string,
    productId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: Review[]; total: number }> {
    const where = { tenantId, productId, status: 'APPROVED' as const };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: ReviewStatus;
      productId?: string;
    },
  ): Promise<{ items: Review[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.productId ? { productId: opts.productId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async summaryForProduct(
    tenantId: string,
    productId: string,
  ): Promise<ReviewSummary> {
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { tenantId, productId, status: 'APPROVED' },
      _count: { _all: true },
    });
    let count = 0;
    let weighted = 0;
    const histogram: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const g of grouped) {
      const c = g._count._all;
      count += c;
      weighted += g.rating * c;
      histogram[String(g.rating)] = c;
    }
    return {
      productId,
      count,
      averageRating: count > 0 ? Number((weighted / count).toFixed(2)) : 0,
      histogram,
    };
  }

  async upsert(tenantId: string, input: CreateReviewInput): Promise<Review> {
    const row = await this.prisma.review.upsert({
      where: {
        tenantId_productId_authorName: {
          tenantId,
          productId: input.productId,
          authorName: input.authorName,
        },
      },
      create: {
        tenantId,
        productId: input.productId,
        customerId: input.customerId ?? null,
        authUserId: input.authUserId ?? null,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body ?? null,
        authorName: input.authorName,
        status: 'PENDING',
      },
      update: {
        rating: input.rating,
        title: input.title ?? null,
        body: input.body ?? null,
        customerId: input.customerId ?? null,
        authUserId: input.authUserId ?? null,
        status: 'PENDING',
        approvedAt: null,
      },
    });
    return toDomain(row);
  }

  async setStatus(
    tenantId: string,
    id: string,
    status: ReviewStatus,
    approvedAt: Date | null,
  ): Promise<Review> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Review ${id} not found`);
    const row = await this.prisma.review.update({
      where: { id },
      data: { status, approvedAt },
    });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.review.delete({ where: { id } });
  }
}

function toDomain(row: Row): Review {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    customerId: row.customerId,
    authUserId: row.authUserId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  };
}
