import type {
  CreateSegmentInput,
  CustomerSegment,
  SegmentRule,
  UpdateSegmentInput,
} from '@claudeshop/contracts/crm';
import type { CustomerSegmentRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  rules: unknown;
  customerCount: number;
  refreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaCustomerSegmentRepository implements CustomerSegmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<CustomerSegment | null> {
    const row = await this.prisma.customerSegment.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: CustomerSegment[]; total: number }> {
    const where = { tenantId };
    const [rows, total] = await Promise.all([
      this.prisma.customerSegment.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.customerSegment.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreateSegmentInput): Promise<CustomerSegment> {
    const row = await this.prisma.customerSegment.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        rules: (input.rules ?? {}) as object,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateSegmentInput,
  ): Promise<CustomerSegment> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Segment ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.rules !== undefined) data.rules = input.rules;
    const row = await this.prisma.customerSegment.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.customerSegment.delete({ where: { id } });
  }

  async setCount(
    tenantId: string,
    id: string,
    count: number,
    refreshedAt: Date,
  ): Promise<CustomerSegment> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Segment ${id} not found`);
    const row = await this.prisma.customerSegment.update({
      where: { id },
      data: { customerCount: count, refreshedAt },
    });
    return toDomain(row);
  }
}

function toDomain(row: Row): CustomerSegment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    rules: (row.rules ?? {}) as SegmentRule,
    customerCount: row.customerCount,
    refreshedAt: row.refreshedAt ? row.refreshedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
