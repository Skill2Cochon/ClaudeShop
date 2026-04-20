import type { Cart, CartItem } from '@claudeshop/contracts/cart';
import type { CartRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Cart | null> {
    const row = await this.prisma.cart.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!row || row.tenantId !== tenantId) return null;
    return toCart(row);
  }

  async findActiveCart(
    tenantId: string,
    ref: { customerId?: string; anonymousId?: string; currency: string },
  ): Promise<Cart | null> {
    if (!ref.customerId && !ref.anonymousId) return null;
    const row = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        currency: ref.currency,
        ...(ref.customerId
          ? { customerId: ref.customerId }
          : { anonymousId: ref.anonymousId ?? undefined }),
      },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? toCart(row) : null;
  }

  async create(
    tenantId: string,
    data: { currency: string; customerId?: string; anonymousId?: string },
  ): Promise<Cart> {
    const row = await this.prisma.cart.create({
      data: {
        tenantId,
        currency: data.currency,
        customerId: data.customerId ?? null,
        anonymousId: data.anonymousId ?? null,
      },
      include: { items: true },
    });
    return toCart(row);
  }

  async addItem(
    tenantId: string,
    cartId: string,
    item: { variantId: string; qty: number; unitPrice: string },
  ): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { id: cartId } });
      if (!cart || cart.tenantId !== tenantId) throw new NotFoundError(`Cart ${cartId} not found`);

      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId, variantId: item.variantId } },
      });

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { qty: { increment: item.qty } },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId,
            variantId: item.variantId,
            qty: item.qty,
            unitPrice: item.unitPrice,
          },
        });
      }

      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });

      const updated = await tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: { items: true },
      });
      return toCart(updated);
    });
  }

  async updateItemQty(
    tenantId: string,
    cartId: string,
    itemId: string,
    qty: number,
  ): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { id: cartId } });
      if (!cart || cart.tenantId !== tenantId) throw new NotFoundError(`Cart ${cartId} not found`);

      if (qty === 0) {
        await tx.cartItem.deleteMany({ where: { id: itemId, cartId } });
      } else {
        const item = await tx.cartItem.findUnique({ where: { id: itemId } });
        if (!item || item.cartId !== cartId) {
          throw new NotFoundError(`Cart item ${itemId} not found`);
        }
        await tx.cartItem.update({ where: { id: itemId }, data: { qty } });
      }

      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });

      const updated = await tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: { items: true },
      });
      return toCart(updated);
    });
  }

  async removeItem(tenantId: string, cartId: string, itemId: string): Promise<Cart> {
    return this.updateItemQty(tenantId, cartId, itemId, 0);
  }

  async getItems(tenantId: string, cartId: string): Promise<CartItem[]> {
    const cart = await this.findById(tenantId, cartId);
    if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
    return cart.items;
  }

  async markOrdered(tenantId: string, cartId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { id: cartId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundError(`Cart ${cartId} not found`);
    }
    // Idempotent: if already ORDERED, don't bump updatedAt for nothing.
    if (existing.status === 'ORDERED') {
      const fetched = await this.prisma.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: { items: true },
      });
      return toCart(fetched);
    }
    const updated = await this.prisma.cart.update({
      where: { id: cartId },
      data: { status: 'ORDERED' },
      include: { items: true },
    });
    return toCart(updated);
  }
}

type PrismaCartWithItems = NonNullable<
  Awaited<ReturnType<PrismaClient['cart']['findUnique']>>
> & {
  items: Awaited<ReturnType<PrismaClient['cartItem']['findMany']>>;
};

function toCart(row: PrismaCartWithItems): Cart {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    anonymousId: row.anonymousId,
    currency: row.currency,
    status: row.status,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    items: row.items.map((i) => ({
      id: i.id,
      cartId: i.cartId,
      variantId: i.variantId,
      qty: i.qty,
      unitPrice: i.unitPrice.toString(),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
