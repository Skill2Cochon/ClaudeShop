import type { PriceSet, Variant } from '@claudeshop/contracts/product';
import type {
  UpsertPriceSetInput,
  VariantRepository,
  VariantSummary,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

export class PrismaVariantRepository implements VariantRepository {
  constructor(
    private readonly prisma: PrismaClient,
    /** Locale used to resolve `Product.name` for summaries (falls back to "en"). */
    private readonly defaultLocale: string = 'en',
  ) {}

  async findById(tenantId: string, variantId: string): Promise<Variant | null> {
    const row = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { product: { select: { tenantId: true } } },
    });
    if (!row || row.product.tenantId !== tenantId) return null;
    return {
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      barcode: row.barcode,
      options: row.options as Record<string, string>,
      weight: row.weight ? row.weight.toString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getSummary(tenantId: string, variantId: string): Promise<VariantSummary | null> {
    const row = await this.prisma.variant.findUnique({
      where: { id: variantId },
      select: {
        sku: true,
        product: { select: { tenantId: true, name: true } },
      },
    });
    if (!row || row.product.tenantId !== tenantId) return null;

    const nameMap = (row.product.name ?? {}) as Record<string, string>;
    const productName =
      nameMap[this.defaultLocale] ??
      nameMap['en'] ??
      Object.values(nameMap)[0] ??
      '';

    return { variantId, sku: row.sku, productName };
  }

  async getPriceFor(
    tenantId: string,
    variantId: string,
    opts: { currency: string; channel?: string },
  ): Promise<string | null> {
    const now = new Date();
    const row = await this.prisma.priceSet.findFirst({
      where: {
        variantId,
        currency: opts.currency,
        channel: opts.channel ?? 'default',
        variant: { product: { tenantId } },
        AND: [
          {
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          },
          {
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
        ],
      },
      orderBy: { validFrom: 'desc' },
    });
    return row ? row.amount.toString() : null;
  }

  async getAvailableStock(tenantId: string, variantId: string): Promise<number> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        variantId,
        variant: { product: { tenantId } },
      },
      select: { onHand: true, reserved: true },
    });
    if (rows.length === 0) return 0;
    return rows.reduce((sum, r) => sum + Math.max(0, r.onHand - r.reserved), 0);
  }

  // ---------------------------------------------------------------- Pricing

  async listPrices(tenantId: string, variantId: string): Promise<PriceSet[]> {
    await this.assertVariantInTenant(tenantId, variantId);
    const rows = await this.prisma.priceSet.findMany({
      where: { variantId },
      orderBy: [{ channel: 'asc' }, { currency: 'asc' }],
    });
    return rows.map(toPriceSet);
  }

  async upsertPrice(
    tenantId: string,
    variantId: string,
    input: UpsertPriceSetInput,
  ): Promise<PriceSet> {
    await this.assertVariantInTenant(tenantId, variantId);
    const currency = input.currency.toUpperCase();
    const channel = input.channel ?? 'default';
    const row = await this.prisma.priceSet.upsert({
      where: {
        variantId_currency_channel: { variantId, currency, channel },
      },
      create: {
        variantId,
        currency,
        channel,
        amount: input.amount,
        taxIncluded: input.taxIncluded ?? false,
        ...(input.validFrom ? { validFrom: new Date(input.validFrom) } : {}),
        ...(input.validTo ? { validTo: new Date(input.validTo) } : {}),
      },
      update: {
        amount: input.amount,
        ...(input.taxIncluded !== undefined
          ? { taxIncluded: input.taxIncluded }
          : {}),
        validFrom:
          input.validFrom === undefined
            ? undefined
            : input.validFrom === null
              ? null
              : new Date(input.validFrom),
        validTo:
          input.validTo === undefined
            ? undefined
            : input.validTo === null
              ? null
              : new Date(input.validTo),
      },
    });
    return toPriceSet(row);
  }

  async deletePrice(
    tenantId: string,
    variantId: string,
    opts: { currency: string; channel?: string },
  ): Promise<void> {
    await this.assertVariantInTenant(tenantId, variantId);
    const currency = opts.currency.toUpperCase();
    const channel = opts.channel ?? 'default';
    await this.prisma.priceSet.deleteMany({
      where: { variantId, currency, channel },
    });
  }

  private async assertVariantInTenant(
    tenantId: string,
    variantId: string,
  ): Promise<void> {
    const row = await this.prisma.variant.findFirst({
      where: { id: variantId, product: { tenantId } },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundError(`Variant ${variantId} not found in tenant`, {
        details: { variantId, tenantId },
      });
    }
  }
}

interface PriceSetRow {
  id: string;
  variantId: string;
  currency: string;
  amount: { toString(): string };
  channel: string;
  validFrom: Date | null;
  validTo: Date | null;
  taxIncluded: boolean;
}

function toPriceSet(row: PriceSetRow): PriceSet {
  return {
    id: row.id,
    variantId: row.variantId,
    currency: row.currency,
    amount: row.amount.toString(),
    channel: row.channel,
    validFrom: row.validFrom ? row.validFrom.toISOString() : null,
    validTo: row.validTo ? row.validTo.toISOString() : null,
    taxIncluded: row.taxIncluded,
  };
}
