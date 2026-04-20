import type {
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
} from '@claudeshop/contracts/erp';
import type {
  PurchaseOrderRepository,
  ReceivePurchaseOrderLinePatch,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type LineRow = {
  id: string;
  purchaseOrderId: string;
  variantId: string;
  sku: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: { toString: () => string };
  subtotal: { toString: () => string };
};

type Row = {
  id: string;
  tenantId: string;
  supplierId: string;
  number: string;
  status: PurchaseOrderStatus;
  currency: string;
  subtotal: { toString: () => string };
  shipping: { toString: () => string };
  tax: { toString: () => string };
  total: { toString: () => string };
  expectedAt: Date | null;
  placedAt: Date | null;
  receivedAt: Date | null;
  notes: string | null;
  lines: LineRow[];
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<PurchaseOrder | null> {
    const row = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: PurchaseOrderStatus;
      supplierId?: string;
    },
  ): Promise<{ items: PurchaseOrder[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { lines: true },
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(
    tenantId: string,
    input: CreatePurchaseOrderInput & {
      number: string;
      subtotal: string;
      total: string;
    },
  ): Promise<PurchaseOrder> {
    const row = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: input.supplierId,
        number: input.number,
        status: 'DRAFT',
        currency: input.currency,
        subtotal: input.subtotal,
        shipping: input.shipping ?? '0',
        tax: input.tax ?? '0',
        total: input.total,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        notes: input.notes ?? null,
        lines: {
          create: input.lines.map((l) => ({
            variantId: l.variantId,
            sku: l.sku,
            qtyOrdered: l.qtyOrdered,
            qtyReceived: 0,
            unitCost: l.unitCost,
            subtotal: computeLineSubtotal(l.unitCost, l.qtyOrdered),
          })),
        },
      },
      include: { lines: true },
    });
    return toDomain(row);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: PurchaseOrderStatus,
    opts?: { placedAt?: Date; receivedAt?: Date },
  ): Promise<PurchaseOrder> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Purchase order ${id} not found`);
    const data: Record<string, unknown> = { status };
    if (opts?.placedAt !== undefined) data.placedAt = opts.placedAt;
    if (opts?.receivedAt !== undefined) data.receivedAt = opts.receivedAt;
    const row = await this.prisma.purchaseOrder.update({
      where: { id },
      data,
      include: { lines: true },
    });
    return toDomain(row);
  }

  async applyReceivedQuantities(
    tenantId: string,
    id: string,
    patches: ReceivePurchaseOrderLinePatch[],
  ): Promise<PurchaseOrder> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Purchase order ${id} not found`);
    await this.prisma.$transaction(
      patches.map((p) =>
        this.prisma.purchaseOrderLine.update({
          where: { id: p.lineId },
          data: { qtyReceived: { increment: p.qty } },
        }),
      ),
    );
    const refreshed = await this.findById(tenantId, id);
    if (!refreshed) throw new NotFoundError(`Purchase order ${id} not found`);
    return refreshed;
  }
}

function computeLineSubtotal(unitCost: string, qty: number): string {
  const cents = toCents(unitCost) * BigInt(qty);
  return fromCents(cents);
}

function toCents(money: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(money.trim());
  if (!match) throw new Error(`Invalid money value: "${money}"`);
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fractional = BigInt((match[3] ?? '').padEnd(2, '0'));
  return sign * (whole * 100n + fractional);
}

function fromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const fractional = abs % 100n;
  return `${sign}${whole.toString()}.${fractional.toString().padStart(2, '0')}`;
}

function toDomain(row: Row): PurchaseOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    supplierId: row.supplierId,
    number: row.number,
    status: row.status,
    currency: row.currency,
    subtotal: row.subtotal.toString(),
    shipping: row.shipping.toString(),
    tax: row.tax.toString(),
    total: row.total.toString(),
    expectedAt: row.expectedAt ? row.expectedAt.toISOString() : null,
    placedAt: row.placedAt ? row.placedAt.toISOString() : null,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    notes: row.notes,
    lines: row.lines.map(toLineDomain),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLineDomain(row: LineRow): PurchaseOrderLine {
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    variantId: row.variantId,
    sku: row.sku,
    qtyOrdered: row.qtyOrdered,
    qtyReceived: row.qtyReceived,
    unitCost: row.unitCost.toString(),
    subtotal: row.subtotal.toString(),
  };
}
