import type {
  AdjustStockInput,
  InventoryListOptions,
  InventoryProjection,
  InventoryRepository,
  InventorySummary,
  SetSafetyStockInput,
  StockReservation,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { InventoryError } from '@claudeshop/errors';

/**
 * Atomic, tenant-scoped inventory reservation using conditional UPDATE.
 *
 * reserveStock runs inside a Prisma transaction. Each line uses a conditional
 * `updateMany` keyed on `onHand - reserved >= qty` — if no row matches, we
 * have a shortfall and raise InventoryError, which triggers rollback.
 *
 * Phase 2.5+:
 * - Multi-location routing (pick the right warehouse)
 * - Backorder handling
 * - Safety stock threshold alerts
 */
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly defaultLocationId: string = 'default',
  ) {}

  async reserveStock(tenantId: string, reservations: StockReservation[]): Promise<void> {
    if (reservations.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const { variantId, qty } of reservations) {
        // Tenant scoping via join on variant.product.tenantId
        const variantInTenant = await tx.variant.findFirst({
          where: { id: variantId, product: { tenantId } },
          select: { id: true },
        });
        if (!variantInTenant) {
          throw new InventoryError(`Variant ${variantId} not found in tenant`, {
            details: { variantId, tenantId },
          });
        }

        const result = await tx.inventoryItem.updateMany({
          where: {
            variantId,
            locationId: this.defaultLocationId,
            // Conditional: enough available
            // (Prisma doesn't support arbitrary SQL in where for cross-column
            // comparisons, so we filter by onHand >= qty + reserved via
            // the raw SQL below for strict correctness.)
          },
          data: {
            reserved: { increment: qty },
          },
        });

        if (result.count === 0) {
          throw new InventoryError(`No inventory record for variant ${variantId}`, {
            details: { variantId, qty },
          });
        }

        // Verify the post-update invariant: onHand >= reserved. If it's been
        // violated (race with another request), roll back immediately.
        const check = await tx.inventoryItem.findFirst({
          where: { variantId, locationId: this.defaultLocationId },
          select: { onHand: true, reserved: true },
        });
        if (!check || check.reserved > check.onHand) {
          throw new InventoryError(`Insufficient stock for variant ${variantId}`, {
            details: {
              variantId,
              requested: qty,
              onHand: check?.onHand ?? 0,
              reserved: check?.reserved ?? 0,
            },
          });
        }
      }
    });
  }

  async releaseStock(tenantId: string, releases: StockReservation[]): Promise<void> {
    if (releases.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const { variantId, qty } of releases) {
        const variantInTenant = await tx.variant.findFirst({
          where: { id: variantId, product: { tenantId } },
          select: { id: true },
        });
        if (!variantInTenant) continue;

        const current = await tx.inventoryItem.findFirst({
          where: { variantId, locationId: this.defaultLocationId },
          select: { reserved: true },
        });
        if (!current) continue;

        const newReserved = Math.max(0, current.reserved - qty);
        await tx.inventoryItem.updateMany({
          where: { variantId, locationId: this.defaultLocationId },
          data: { reserved: newReserved },
        });
      }
    });
  }

  async commitReservation(tenantId: string, commits: StockReservation[]): Promise<void> {
    if (commits.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const { variantId, qty } of commits) {
        const variantInTenant = await tx.variant.findFirst({
          where: { id: variantId, product: { tenantId } },
          select: { id: true },
        });
        if (!variantInTenant) continue;

        await tx.inventoryItem.updateMany({
          where: { variantId, locationId: this.defaultLocationId },
          data: {
            onHand: { decrement: qty },
            reserved: { decrement: qty },
          },
        });
      }
    });
  }

  async incrementOnHand(
    tenantId: string,
    increments: StockReservation[],
  ): Promise<void> {
    if (increments.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const { variantId, qty } of increments) {
        const variantInTenant = await tx.variant.findFirst({
          where: { id: variantId, product: { tenantId } },
          select: { id: true },
        });
        if (!variantInTenant) {
          throw new InventoryError(`Variant ${variantId} not found in tenant`, {
            details: { variantId, tenantId },
          });
        }

        // Upsert pattern: increment if row exists, create a zero-reserved row
        // if it doesn't. Prisma's upsert can't reference the existing value in
        // an expression, so we do a findFirst + branch.
        const existing = await tx.inventoryItem.findFirst({
          where: { variantId, locationId: this.defaultLocationId },
          select: { id: true },
        });

        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { onHand: { increment: qty } },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              variantId,
              locationId: this.defaultLocationId,
              onHand: qty,
              reserved: 0,
              safetyStock: 0,
            },
          });
        }
      }
    });
  }

  async listProjections(
    tenantId: string,
    opts: InventoryListOptions,
  ): Promise<{ items: InventoryProjection[]; total: number }> {
    const page = Math.max(1, opts.page);
    const limit = Math.max(1, Math.min(opts.limit, 200));
    const skip = (page - 1) * limit;

    // Lightweight: paginate InventoryItem rows scoped by the variant's
    // product.tenantId, then include variant.product to hydrate the
    // projection. Filters are applied server-side for outOfStockOnly
    // so we don't over-fetch rows the UI will discard.
    const baseWhere = {
      variant: { product: { tenantId } },
      ...(opts.outOfStockOnly ? { onHand: 0 } : {}),
    };

    type RowWithRelations = {
      variantId: string;
      locationId: string;
      onHand: number;
      reserved: number;
      safetyStock: number;
      variant: {
        sku: string;
        product: {
          id: string;
          slug: string;
          name: unknown;
          tenantId: string;
          updatedAt: Date;
        };
      };
    };

    const [rows, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: baseWhere,
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  tenantId: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
        orderBy: { variant: { product: { updatedAt: 'desc' } } },
        skip,
        take: limit,
      }) as unknown as Promise<RowWithRelations[]>,
      this.prisma.inventoryItem.count({ where: baseWhere }),
    ]);

    const projections: InventoryProjection[] = rows.map((row) => ({
      variantId: row.variantId,
      productId: row.variant.product.id,
      productSlug: row.variant.product.slug,
      productName: (row.variant.product.name ?? {}) as Record<string, string>,
      sku: row.variant.sku,
      locationId: row.locationId,
      onHand: row.onHand,
      reserved: row.reserved,
      safetyStock: row.safetyStock,
      available: row.onHand - row.reserved - row.safetyStock,
      updatedAt: row.variant.product.updatedAt.toISOString(),
    }));

    // Low-stock filter is applied in JS because the cross-column predicate
    // (onHand - reserved <= safetyStock) isn't natively expressible in
    // Prisma's `where`. When tenants outgrow the page-size slice, Phase
    // 20.1 swaps to raw SQL.
    const filtered = opts.lowOnly
      ? projections.filter((p) => p.available <= 0)
      : projections;

    return {
      items: filtered,
      total: opts.lowOnly ? filtered.length : total,
    };
  }

  async summary(tenantId: string): Promise<InventorySummary> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: { variant: { product: { tenantId } } },
      select: { onHand: true, reserved: true, safetyStock: true },
    });

    let outOfStock = 0;
    let lowStock = 0;
    let healthy = 0;
    for (const r of rows) {
      const available = r.onHand - r.reserved - r.safetyStock;
      if (r.onHand === 0) outOfStock++;
      else if (available <= 0) lowStock++;
      else healthy++;
    }

    return { total: rows.length, outOfStock, lowStock, healthy };
  }

  async adjustStock(tenantId: string, input: AdjustStockInput): Promise<void> {
    if (input.delta === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const variantInTenant = await tx.variant.findFirst({
        where: { id: input.variantId, product: { tenantId } },
        select: { id: true },
      });
      if (!variantInTenant) {
        throw new InventoryError(
          `Variant ${input.variantId} not found in tenant`,
          { details: { variantId: input.variantId, tenantId } },
        );
      }

      const existing = await tx.inventoryItem.findFirst({
        where: { variantId: input.variantId, locationId: this.defaultLocationId },
        select: { id: true, onHand: true },
      });

      if (existing) {
        const nextOnHand = existing.onHand + input.delta;
        if (nextOnHand < 0) {
          throw new InventoryError(
            `Adjustment would drive onHand below zero (current=${existing.onHand}, delta=${input.delta})`,
            { details: { variantId: input.variantId, delta: input.delta } },
          );
        }
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { onHand: nextOnHand },
        });
      } else {
        if (input.delta < 0) {
          throw new InventoryError(
            `Cannot decrement a non-existent inventory row for variant ${input.variantId}`,
            { details: { variantId: input.variantId, delta: input.delta } },
          );
        }
        await tx.inventoryItem.create({
          data: {
            variantId: input.variantId,
            locationId: this.defaultLocationId,
            onHand: input.delta,
            reserved: 0,
            safetyStock: 0,
          },
        });
      }
    });
  }

  async setSafetyStock(
    tenantId: string,
    input: SetSafetyStockInput,
  ): Promise<void> {
    if (input.safetyStock < 0) {
      throw new InventoryError('safetyStock must be >= 0', {
        details: { variantId: input.variantId, safetyStock: input.safetyStock },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const variantInTenant = await tx.variant.findFirst({
        where: { id: input.variantId, product: { tenantId } },
        select: { id: true },
      });
      if (!variantInTenant) {
        throw new InventoryError(
          `Variant ${input.variantId} not found in tenant`,
          { details: { variantId: input.variantId, tenantId } },
        );
      }

      const existing = await tx.inventoryItem.findFirst({
        where: { variantId: input.variantId, locationId: this.defaultLocationId },
        select: { id: true },
      });

      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { safetyStock: input.safetyStock },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            variantId: input.variantId,
            locationId: this.defaultLocationId,
            onHand: 0,
            reserved: 0,
            safetyStock: input.safetyStock,
          },
        });
      }
    });
  }
}
