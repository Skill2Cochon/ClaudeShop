import type {
  CreateShippingRateInput,
  ShippingRate,
  UpdateShippingRateInput,
} from '@claudeshop/contracts/checkout';
import type { ShippingRateRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  countryCodes: unknown;
  currency: string;
  basePriceCents: number;
  minSubtotalCents: number | null;
  freeShippingAboveCents: number | null;
  estimatedDays: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaShippingRateRepository implements ShippingRateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<ShippingRate | null> {
    const row = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean },
  ): Promise<{ items: ShippingRate[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.shippingRate.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.shippingRate.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(
    tenantId: string,
    input: CreateShippingRateInput,
  ): Promise<ShippingRate> {
    const row = await this.prisma.shippingRate.create({
      data: {
        tenantId,
        name: input.name,
        countryCodes: input.countryCodes,
        currency: input.currency,
        basePriceCents: input.basePriceCents,
        minSubtotalCents: input.minSubtotalCents ?? null,
        freeShippingAboveCents: input.freeShippingAboveCents ?? null,
        estimatedDays: input.estimatedDays ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateShippingRateInput,
  ): Promise<ShippingRate> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Shipping rate ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.countryCodes !== undefined) data.countryCodes = input.countryCodes;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.basePriceCents !== undefined) data.basePriceCents = input.basePriceCents;
    if (input.minSubtotalCents !== undefined)
      data.minSubtotalCents = input.minSubtotalCents;
    if (input.freeShippingAboveCents !== undefined)
      data.freeShippingAboveCents = input.freeShippingAboveCents;
    if (input.estimatedDays !== undefined) data.estimatedDays = input.estimatedDays;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    const row = await this.prisma.shippingRate.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.shippingRate.delete({ where: { id } });
  }

  async findApplicable(
    tenantId: string,
    opts: { country: string; currency: string; subtotalCents: number },
  ): Promise<ShippingRate[]> {
    const rows = await this.prisma.shippingRate.findMany({
      where: {
        tenantId,
        isActive: true,
        currency: opts.currency.toUpperCase(),
      },
      orderBy: { basePriceCents: 'asc' },
    });
    return rows
      .map(toDomain)
      .filter((rate) => rate.countryCodes.includes(opts.country.toUpperCase()))
      .filter(
        (rate) =>
          rate.minSubtotalCents === null ||
          opts.subtotalCents >= rate.minSubtotalCents,
      );
  }
}

function toDomain(row: Row): ShippingRate {
  const codes = Array.isArray(row.countryCodes)
    ? row.countryCodes.filter((c): c is string => typeof c === 'string')
    : [];
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    countryCodes: codes,
    currency: row.currency,
    basePriceCents: row.basePriceCents,
    minSubtotalCents: row.minSubtotalCents,
    freeShippingAboveCents: row.freeShippingAboveCents,
    estimatedDays: row.estimatedDays,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
