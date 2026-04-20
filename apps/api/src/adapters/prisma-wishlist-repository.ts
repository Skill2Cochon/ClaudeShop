import type { PrismaClient } from '@claudeshop/db';
import type { WishlistEntry, WishlistRepository } from '@claudeshop/core';

export class PrismaWishlistRepository implements WishlistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, customerId: string): Promise<WishlistEntry[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true, createdAt: true },
    });
    return rows.map((r) => ({
      productId: r.productId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async toggle(
    tenantId: string,
    customerId: string,
    productId: string,
  ): Promise<{ favourited: boolean }> {
    // Try to remove first — if a row matches, we delete it; otherwise we
    // insert a new one. Done in a transaction so two parallel toggles can't
    // race into a duplicate row.
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.wishlistItem.findUnique({
        where: {
          tenantId_customerId_productId: { tenantId, customerId, productId },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.wishlistItem.delete({ where: { id: existing.id } });
        return { favourited: false };
      }
      await tx.wishlistItem.create({
        data: { tenantId, customerId, productId },
      });
      return { favourited: true };
    });
  }

  async isFavourited(
    tenantId: string,
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    const row = await this.prisma.wishlistItem.findUnique({
      where: {
        tenantId_customerId_productId: { tenantId, customerId, productId },
      },
      select: { id: true },
    });
    return row !== null;
  }
}
