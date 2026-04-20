import type {
  CreateCustomerAddressInput,
  CustomerAddress,
  UpdateCustomerAddressInput,
} from '@claudeshop/contracts/customer';
import type { CustomerAddressRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  customerId: string;
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaCustomerAddressRepository
  implements CustomerAddressRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerAddress[]> {
    const rows = await this.prisma.customerAddress.findMany({
      where: { tenantId, customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toDomain);
  }

  async findById(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddress | null> {
    const row = await this.prisma.customerAddress.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId || row.customerId !== customerId) {
      return null;
    }
    return toDomain(row);
  }

  async create(
    tenantId: string,
    customerId: string,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddress> {
    // When the caller asks for this to be default, clear the flag
    // on every other row in the same customer's book first. Wrapped
    // in a transaction so we never leave 2+ defaults observable.
    const result = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { tenantId, customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // First address a customer adds gets isDefault: true by
      // convention — otherwise the checkout prefill has nothing to
      // show. Subsequent addresses default to false unless the
      // caller asked for it explicitly.
      const count = await tx.customerAddress.count({
        where: { tenantId, customerId },
      });
      const isDefault = input.isDefault ?? count === 0;

      return tx.customerAddress.create({
        data: {
          tenantId,
          customerId,
          label: input.label ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          company: input.company ?? null,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          region: input.region ?? null,
          postcode: input.postcode,
          country: input.country.toUpperCase(),
          phone: input.phone ?? null,
          isDefault,
        },
      });
    });
    return toDomain(result);
  }

  async update(
    tenantId: string,
    customerId: string,
    id: string,
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddress> {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (
      !existing ||
      existing.tenantId !== tenantId ||
      existing.customerId !== customerId
    ) {
      throw new NotFoundError(`Address ${id} not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: {
            tenantId,
            customerId,
            isDefault: true,
            NOT: { id },
          },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.update({
        where: { id },
        data: {
          ...(input.label !== undefined ? { label: input.label || null } : {}),
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.company !== undefined
            ? { company: input.company || null }
            : {}),
          ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
          ...(input.line2 !== undefined ? { line2: input.line2 || null } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.region !== undefined ? { region: input.region || null } : {}),
          ...(input.postcode !== undefined ? { postcode: input.postcode } : {}),
          ...(input.country !== undefined
            ? { country: input.country.toUpperCase() }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
        },
      });
    });
    return toDomain(result);
  }

  async remove(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<void> {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (
      !existing ||
      existing.tenantId !== tenantId ||
      existing.customerId !== customerId
    ) {
      // Silent 404 — caller gets "already gone" semantics.
      return;
    }

    const wasDefault = existing.isDefault;
    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id } });
      // If we just removed the default, promote the next-newest
      // address so the checkout prefill isn't left dangling.
      if (wasDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { tenantId, customerId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.customerAddress.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async setDefault(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddress> {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (
      !existing ||
      existing.tenantId !== tenantId ||
      existing.customerId !== customerId
    ) {
      throw new NotFoundError(`Address ${id} not found`);
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: {
          tenantId,
          customerId,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
      return tx.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
    return toDomain(result);
  }
}

function toDomain(row: Row): CustomerAddress {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    label: row.label,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postcode: row.postcode,
    country: row.country,
    phone: row.phone,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
