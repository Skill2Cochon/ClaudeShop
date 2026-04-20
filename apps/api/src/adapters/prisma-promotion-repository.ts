import type { PrismaClient } from '@claudeshop/db';
import type {
  CreatePromotionInput,
  Promotion,
  PromotionStatus,
  PromotionType,
  UpdatePromotionInput,
} from '@claudeshop/contracts/promotion';
import type { PromotionRepository } from '@claudeshop/core';
import { ConflictError, NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: PromotionType;
  value: number;
  status: PromotionStatus;
  currency: string | null;
  minSubtotalCents: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Promotion | null> {
    const row = await this.prisma.promotion.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findByCode(tenantId: string, code: string): Promise<Promotion | null> {
    const row = await this.prisma.promotion.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PromotionStatus },
  ): Promise<{ items: Promotion[]; total: number }> {
    const where = { tenantId, ...(opts.status ? { status: opts.status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreatePromotionInput): Promise<Promotion> {
    const row = await this.prisma.promotion.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        value: input.value,
        status: input.status ?? 'ACTIVE',
        currency: input.currency ?? null,
        minSubtotalCents: input.minSubtotalCents ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        maxRedemptions: input.maxRedemptions ?? null,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdatePromotionInput,
  ): Promise<Promotion> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Promotion ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.value !== undefined) data.value = input.value;
    if (input.status !== undefined) data.status = input.status;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.minSubtotalCents !== undefined) data.minSubtotalCents = input.minSubtotalCents;
    if (input.startsAt !== undefined)
      data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (input.endsAt !== undefined)
      data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.maxRedemptions !== undefined) data.maxRedemptions = input.maxRedemptions;
    const row = await this.prisma.promotion.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.promotion.delete({ where: { id } });
  }

  async incrementRedemption(tenantId: string, id: string): Promise<Promotion> {
    // Race-condition-safe: UPDATE … WHERE redemptionCount < maxRedemptions
    // OR maxRedemptions IS NULL. If zero rows matched, we know the cap was
    // already hit and throw ConflictError.
    const updated = await this.prisma.promotion.updateMany({
      where: {
        id,
        tenantId,
        OR: [
          { maxRedemptions: null },
          { redemptionCount: { lt: this.prisma.promotion.fields.maxRedemptions } },
        ],
      },
      data: { redemptionCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new ConflictError(`Promotion ${id} is fully redeemed`);
    }
    const refreshed = await this.findById(tenantId, id);
    if (!refreshed) throw new NotFoundError(`Promotion ${id} not found`);
    return refreshed;
  }
}

function toDomain(row: Row): Promotion {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    type: row.type,
    value: row.value,
    status: row.status,
    currency: row.currency,
    minSubtotalCents: row.minSubtotalCents,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
