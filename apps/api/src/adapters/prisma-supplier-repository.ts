import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from '@claudeshop/contracts/erp';
import type { SupplierRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  currency: string;
  paymentTermsDays: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findByName(tenantId: string, name: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean },
  ): Promise<{ items: Supplier[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreateSupplierInput): Promise<Supplier> {
    const row = await this.prisma.supplier.create({
      data: {
        tenantId,
        name: input.name,
        contactEmail: input.contactEmail ?? null,
        phone: input.phone ?? null,
        currency: input.currency,
        paymentTermsDays: input.paymentTermsDays ?? 30,
        notes: input.notes ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Supplier ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.paymentTermsDays !== undefined)
      data.paymentTermsDays = input.paymentTermsDays;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    const row = await this.prisma.supplier.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.supplier.delete({ where: { id } });
  }
}

function toDomain(row: Row): Supplier {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    contactEmail: row.contactEmail,
    phone: row.phone,
    currency: row.currency,
    paymentTermsDays: row.paymentTermsDays,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
