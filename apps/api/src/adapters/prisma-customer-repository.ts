import type { CreateCustomerInput, Customer } from '@claudeshop/contracts/customer';
import type { SegmentRule } from '@claudeshop/contracts/crm';
import type {
  CustomerRepository,
  ListCustomersOptions,
  SegmentMember,
} from '@claudeshop/core';
import type { PrismaClient, Prisma } from '@claudeshop/db';

type Row = {
  id: string;
  tenantId: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  group: 'B2C' | 'B2B' | 'VIP';
  acceptsMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async create(tenantId: string, input: CreateCustomerInput): Promise<Customer> {
    const row = await this.prisma.customer.create({
      data: {
        tenantId,
        email: input.email,
        phone: input.phone ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        group: input.group ?? 'B2C',
        acceptsMarketing: input.acceptsMarketing ?? false,
      },
    });
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: ListCustomersOptions,
  ): Promise<{ items: Customer[]; total: number }> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const where: Prisma.CustomerWhereInput = { tenantId };
    if (opts.group) where.group = opts.group;
    if (opts.acceptsMarketing !== undefined) {
      where.acceptsMarketing = opts.acceptsMarketing;
    }
    const trimmed = opts.query?.trim();
    if (trimmed) {
      where.OR = [
        { email: { contains: trimmed, mode: 'insensitive' } },
        { firstName: { contains: trimmed, mode: 'insensitive' } },
        { lastName: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findSegmentMembers(
    tenantId: string,
    rules: SegmentRule,
    opts?: { page?: number; limit?: number },
  ): Promise<{ items: SegmentMember[]; total: number }> {
    const where = buildSegmentWhere(tenantId, rules);
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 200;

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: { id: true, email: true },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ customerId: r.id, email: r.email })),
      total,
    };
  }
}

function buildSegmentWhere(
  tenantId: string,
  rules: SegmentRule,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { tenantId };
  if (rules.customerGroup) where.group = rules.customerGroup;
  if (rules.acceptsMarketing !== undefined) {
    where.acceptsMarketing = rules.acceptsMarketing;
  }
  if (rules.createdWithinDays) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - rules.createdWithinDays);
    where.createdAt = { gte: since };
  }
  if (rules.hasOrdered === true) {
    where.orders = { some: {} };
  } else if (rules.hasOrdered === false) {
    where.orders = { none: {} };
  }
  // minLifetimeValueCents requires aggregating orders.total → handled
  // post-filter in JS once Phase 11.1 lands a denormalised lifetime value
  // column on Customer. For now, the rule is accepted but ignored.
  return where;
}

function toDomain(row: Row): Customer {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    phone: row.phone,
    firstName: row.firstName,
    lastName: row.lastName,
    group: row.group,
    acceptsMarketing: row.acceptsMarketing,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
