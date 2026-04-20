import type { Order, OrderStatus } from '@claudeshop/contracts/order';
import type { ListOrdersOptions, OrderRepository } from '@claudeshop/core';
import type { PrismaClient, Prisma } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!row || row.tenantId !== tenantId) return null;
    return toOrder(row);
  }

  async findByNumber(tenantId: string, number: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { tenantId_number: { tenantId, number } },
      include: { lines: true },
    });
    return row ? toOrder(row) : null;
  }

  async list(
    tenantId: string,
    opts: ListOrdersOptions,
  ): Promise<{ items: Order[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.customerEmail ? { anonymousEmail: opts.customerEmail } : {}),
    };

    // Number search: admin types "CS-42" or just "42" — contains match,
    // case-insensitive. No index on `number LIKE '%x%'` but volumes at
    // current merchant scale (< 10k/tenant/month) are fine; if this
    // ever gets hot we add a trigram index on Order.number.
    const numberQuery = opts.numberQuery?.trim();
    if (numberQuery) {
      where.number = { contains: numberQuery, mode: 'insensitive' };
    }

    // Date range on placedAt. Drafts have placedAt=null so they fall
    // out of the range — which is correct: a date-ranged orders view
    // is about placed orders, not shopping carts in flight.
    if (opts.placedFrom || opts.placedTo) {
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      if (opts.placedFrom) dateFilter.gte = new Date(opts.placedFrom);
      if (opts.placedTo) dateFilter.lte = new Date(opts.placedTo);
      where.placedAt = dateFilter;
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { lines: true },
        orderBy: { placedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map(toOrder), total };
  }

  async create(
    tenantId: string,
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Order> {
    const row = await this.prisma.order.create({
      data: {
        tenantId,
        number: order.number,
        customerId: order.customerId,
        anonymousEmail: order.anonymousEmail,
        status: order.status,
        currency: order.currency,
        subtotal: order.totals.subtotal,
        tax: order.totals.tax,
        discount: order.totals.discount,
        shipping: order.totals.shipping,
        total: order.totals.total,
        placedAt: order.placedAt ? new Date(order.placedAt) : null,
        lines: {
          create: order.lines.map((l) => ({
            variantId: l.variantId,
            productName: l.productName,
            sku: l.sku,
            qty: l.qty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            tax: l.tax,
            discount: l.discount,
            total: l.total,
          })),
        },
      },
      include: { lines: true },
    });
    return toOrder(row);
  }

  async updateStatus(tenantId: string, id: string, status: OrderStatus): Promise<Order> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Order ${id} not found`);
    const row = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { lines: true },
    });
    return toOrder(row);
  }
}

type PrismaOrderWithLines = NonNullable<
  Awaited<ReturnType<PrismaClient['order']['findUnique']>>
> & {
  lines: Awaited<ReturnType<PrismaClient['orderLine']['findMany']>>;
};

function toOrder(row: PrismaOrderWithLines): Order {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    customerId: row.customerId,
    anonymousEmail: row.anonymousEmail,
    status: row.status,
    currency: row.currency,
    totals: {
      subtotal: row.subtotal.toString(),
      tax: row.tax.toString(),
      discount: row.discount.toString(),
      shipping: row.shipping.toString(),
      total: row.total.toString(),
    },
    lines: row.lines.map((l) => ({
      id: l.id,
      orderId: l.orderId,
      variantId: l.variantId,
      productName: l.productName,
      sku: l.sku,
      qty: l.qty,
      unitPrice: l.unitPrice.toString(),
      subtotal: l.subtotal.toString(),
      tax: l.tax.toString(),
      discount: l.discount.toString(),
      total: l.total.toString(),
    })),
    placedAt: row.placedAt ? row.placedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
