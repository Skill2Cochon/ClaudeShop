import type {
  CreateTaxRateInput,
  TaxRate,
  UpdateTaxRateInput,
} from '@claudeshop/contracts/checkout';
import type { TaxRateRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  countryCode: string;
  regionCode: string | null;
  postcodePattern: string | null;
  rateBp: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaTaxRateRepository implements TaxRateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<TaxRate | null> {
    const row = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean; countryCode?: string },
  ): Promise<{ items: TaxRate[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.countryCode ? { countryCode: opts.countryCode } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.taxRate.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreateTaxRateInput): Promise<TaxRate> {
    const row = await this.prisma.taxRate.create({
      data: {
        tenantId,
        name: input.name,
        countryCode: input.countryCode,
        regionCode: input.regionCode ?? null,
        postcodePattern: input.postcodePattern ?? null,
        rateBp: input.rateBp,
        priority: input.priority ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateTaxRateInput,
  ): Promise<TaxRate> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Tax rate ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.countryCode !== undefined) data.countryCode = input.countryCode;
    if (input.regionCode !== undefined) data.regionCode = input.regionCode;
    if (input.postcodePattern !== undefined) data.postcodePattern = input.postcodePattern;
    if (input.rateBp !== undefined) data.rateBp = input.rateBp;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    const row = await this.prisma.taxRate.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.taxRate.delete({ where: { id } });
  }

  async findApplicable(
    tenantId: string,
    address: { country: string; region?: string; postcode?: string },
  ): Promise<TaxRate[]> {
    const rows = await this.prisma.taxRate.findMany({
      where: {
        tenantId,
        countryCode: address.country.toUpperCase(),
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });
    return rows
      .filter((row) => {
        if (row.regionCode && row.regionCode !== (address.region ?? null)) return false;
        if (row.postcodePattern) {
          if (!address.postcode) return false;
          try {
            return new RegExp(`^${row.postcodePattern}$`, 'i').test(address.postcode);
          } catch {
            return false;
          }
        }
        return true;
      })
      .map(toDomain);
  }
}

function toDomain(row: Row): TaxRate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    countryCode: row.countryCode,
    regionCode: row.regionCode,
    postcodePattern: row.postcodePattern,
    rateBp: row.rateBp,
    priority: row.priority,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
