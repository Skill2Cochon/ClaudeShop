import type { PrismaClient } from '@claudeshop/db';
import type {
  AnalyticsRepository,
  InventoryHealth,
  OrderStatusBreakdown,
  RevenueSummary,
  RevenueWindow,
  TopProductRow,
} from '@claudeshop/core';

const PAID_STATUSES = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] as const;

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getRevenueSummary(
    tenantId: string,
    opts: { days: number },
  ): Promise<RevenueSummary> {
    const since = daysAgo(opts.days);

    // Day-bucketed aggregation. Postgres date_trunc + GROUP BY.
    const buckets = await this.prisma.$queryRawUnsafe<
      Array<{ day: Date; revenue: { toString(): string } | null; count: bigint }>
    >(
      `
      SELECT date_trunc('day', "placedAt") AS "day",
             SUM("total")               AS "revenue",
             COUNT(*)                   AS "count"
      FROM   "Order"
      WHERE  "tenantId" = $1
        AND  "status" = ANY($2::"OrderStatus"[])
        AND  "placedAt" >= $3
      GROUP  BY date_trunc('day', "placedAt")
      ORDER  BY day ASC
      `,
      tenantId,
      PAID_STATUSES,
      since,
    );

    const summary = buckets.reduce<{
      totalCents: bigint;
      orderCount: number;
    }>(
      (acc, row) => {
        const cents = toCents(row.revenue?.toString() ?? '0');
        return {
          totalCents: acc.totalCents + cents,
          orderCount: acc.orderCount + Number(row.count),
        };
      },
      { totalCents: 0n, orderCount: 0 },
    );

    // Use the most recent paid order's currency so the dashboard reflects the
    // store's actual money. (Multi-currency stores get a follow-up phase.)
    const latest = await this.prisma.order.findFirst({
      where: {
        tenantId,
        status: { in: ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] },
      },
      orderBy: { placedAt: 'desc' },
      select: { currency: true },
    });

    return {
      total: fromCents(summary.totalCents),
      orderCount: summary.orderCount,
      currency: latest?.currency ?? 'EUR',
      buckets: buckets.map<RevenueWindow>((row) => ({
        date: row.day.toISOString().slice(0, 10),
        revenue: row.revenue?.toString() ?? '0',
        orderCount: Number(row.count),
      })),
    };
  }

  async getTopProducts(
    tenantId: string,
    opts: { days: number; limit: number },
  ): Promise<TopProductRow[]> {
    const since = daysAgo(opts.days);
    const limit = Math.max(1, Math.min(opts.limit, 50));

    // Join OrderLine → Variant → Product to get the productId. Aggregate qty
    // and revenue per product (sum of line totals).
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        productId: string;
        sku: string;
        productName: string;
        qty: bigint;
        revenue: { toString(): string } | null;
      }>
    >(
      `
      SELECT  v."productId"        AS "productId",
              MIN(ol."sku")        AS "sku",
              MIN(ol."productName") AS "productName",
              SUM(ol."qty")        AS "qty",
              SUM(ol."total")      AS "revenue"
      FROM    "OrderLine" ol
      JOIN    "Variant"   v  ON v."id" = ol."variantId"
      JOIN    "Order"     o  ON o."id" = ol."orderId"
      WHERE   o."tenantId" = $1
        AND   o."status" = ANY($2::"OrderStatus"[])
        AND   o."placedAt" >= $3
      GROUP   BY v."productId"
      ORDER   BY SUM(ol."total") DESC
      LIMIT   $4
      `,
      tenantId,
      PAID_STATUSES,
      since,
      limit,
    );

    return rows.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      productName: r.productName,
      qty: Number(r.qty),
      revenue: r.revenue?.toString() ?? '0',
    }));
  }

  async getInventoryHealth(tenantId: string): Promise<InventoryHealth> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        total: bigint;
        low: bigint;
        out: bigint;
        over: bigint;
      }>
    >(
      `
      SELECT
        COUNT(*) FILTER (WHERE TRUE)                                          AS "total",
        COUNT(*) FILTER (
          WHERE i."onHand" > 0
            AND i."safetyStock" > 0
            AND i."onHand" <= i."safetyStock"
        )                                                                      AS "low",
        COUNT(*) FILTER (WHERE i."onHand" = 0)                                 AS "out",
        COUNT(*) FILTER (WHERE i."onHand" > 1000)                              AS "over"
      FROM   "InventoryItem" i
      JOIN   "Variant"       v ON v."id" = i."variantId"
      JOIN   "Product"       p ON p."id" = v."productId"
      WHERE  p."tenantId" = $1
      `,
      tenantId,
    );

    const row = rows[0] ?? { total: 0n, low: 0n, out: 0n, over: 0n };
    return {
      totalVariants: Number(row.total),
      lowStockCount: Number(row.low),
      outOfStockCount: Number(row.out),
      overstockCount: Number(row.over),
    };
  }

  async getOrderStatusBreakdown(
    tenantId: string,
    opts: { days: number },
  ): Promise<OrderStatusBreakdown> {
    const since = daysAgo(opts.days);
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) {
      counts[g.status] = g._count._all;
    }
    return { counts, windowDays: opts.days };
  }
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function toCents(money: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(money.trim());
  if (!match) return 0n;
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
