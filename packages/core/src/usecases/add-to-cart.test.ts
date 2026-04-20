import { beforeEach, describe, expect, it } from 'vitest';
import type { Cart, CartItem } from '@claudeshop/contracts/cart';
import type { Variant } from '@claudeshop/contracts/product';
import { InventoryError, NotFoundError, ValidationError } from '@claudeshop/errors';
import type { CartRepository } from '../ports/cart-repository.js';
import type { VariantRepository } from '../ports/variant-repository.js';
import { addToCart } from './add-to-cart.js';

/** In-memory implementations for deterministic TDD. */

class InMemoryCartRepository implements CartRepository {
  public readonly carts = new Map<string, Cart>();

  private nextId(prefix: string): string {
    return `${prefix}${Math.random().toString(36).slice(2)}`.padEnd(24, '0').slice(0, 24);
  }

  async findById(tenantId: string, id: string): Promise<Cart | null> {
    const cart = this.carts.get(id);
    return cart && cart.tenantId === tenantId ? cart : null;
  }

  async findActiveCart(
    tenantId: string,
    ref: { customerId?: string; anonymousId?: string; currency: string },
  ): Promise<Cart | null> {
    for (const cart of this.carts.values()) {
      if (cart.tenantId !== tenantId) continue;
      if (cart.status !== 'ACTIVE') continue;
      if (cart.currency !== ref.currency) continue;
      if (ref.customerId && cart.customerId === ref.customerId) return cart;
      if (ref.anonymousId && cart.anonymousId === ref.anonymousId) return cart;
    }
    return null;
  }

  async create(
    tenantId: string,
    data: { currency: string; customerId?: string; anonymousId?: string },
  ): Promise<Cart> {
    const id = this.nextId('cart');
    const now = new Date().toISOString();
    const cart: Cart = {
      id,
      tenantId,
      customerId: data.customerId ?? null,
      anonymousId: data.anonymousId ?? null,
      currency: data.currency,
      status: 'ACTIVE',
      expiresAt: null,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    this.carts.set(id, cart);
    return cart;
  }

  async addItem(
    tenantId: string,
    cartId: string,
    item: { variantId: string; qty: number; unitPrice: string },
  ): Promise<Cart> {
    const cart = await this.findById(tenantId, cartId);
    if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
    const now = new Date().toISOString();

    const existing = cart.items.find((i) => i.variantId === item.variantId);
    let items: CartItem[];
    if (existing) {
      items = cart.items.map((i) =>
        i.variantId === item.variantId
          ? { ...i, qty: i.qty + item.qty, updatedAt: now }
          : i,
      );
    } else {
      const newItem: CartItem = {
        id: this.nextId('ci'),
        cartId: cart.id,
        variantId: item.variantId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        createdAt: now,
        updatedAt: now,
      };
      items = [...cart.items, newItem];
    }

    const updated: Cart = { ...cart, items, updatedAt: now };
    this.carts.set(cart.id, updated);
    return updated;
  }

  async updateItemQty(
    tenantId: string,
    cartId: string,
    itemId: string,
    qty: number,
  ): Promise<Cart> {
    const cart = await this.findById(tenantId, cartId);
    if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
    const now = new Date().toISOString();
    const items =
      qty === 0
        ? cart.items.filter((i) => i.id !== itemId)
        : cart.items.map((i) => (i.id === itemId ? { ...i, qty, updatedAt: now } : i));
    const updated: Cart = { ...cart, items, updatedAt: now };
    this.carts.set(cart.id, updated);
    return updated;
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
    const cart = await this.findById(tenantId, cartId);
    if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
    const updated: Cart = { ...cart, status: 'ORDERED', updatedAt: new Date().toISOString() };
    this.carts.set(cartId, updated);
    return updated;
  }
}

class StubVariantRepository implements VariantRepository {
  private readonly prices = new Map<string, string>(); // variantId:currency -> amount
  private readonly stock = new Map<string, number>();
  private readonly variants = new Map<string, Variant>();

  setVariant(v: Variant): void {
    this.variants.set(v.id, v);
  }
  setPrice(variantId: string, currency: string, amount: string): void {
    this.prices.set(`${variantId}:${currency}`, amount);
  }
  setStock(variantId: string, qty: number): void {
    this.stock.set(variantId, qty);
  }

  async findById(_tenantId: string, variantId: string): Promise<Variant | null> {
    return this.variants.get(variantId) ?? null;
  }

  async getSummary(
    _tenantId: string,
    variantId: string,
  ): Promise<{ variantId: string; sku: string; productName: string } | null> {
    const v = this.variants.get(variantId);
    if (!v) return null;
    return { variantId, sku: v.sku, productName: '' };
  }

  async getPriceFor(
    _tenantId: string,
    variantId: string,
    opts: { currency: string; channel?: string },
  ): Promise<string | null> {
    return this.prices.get(`${variantId}:${opts.currency}`) ?? null;
  }

  async getAvailableStock(_tenantId: string, variantId: string): Promise<number> {
    return this.stock.get(variantId) ?? 0;
  }
}

describe('addToCart use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const variantId = 'vrntA0000000000000000000';

  let cartRepo: InMemoryCartRepository;
  let variantRepo: StubVariantRepository;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    variantRepo = new StubVariantRepository();
    variantRepo.setPrice(variantId, 'EUR', '29.90');
    variantRepo.setStock(variantId, 100);
  });

  it('creates a new cart when none exists for the anonymous session', async () => {
    const cart = await addToCart(
      { variantId, qty: 1, anonymousId: 'anon-session-0001' },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.variantId).toBe(variantId);
    expect(cart.items[0]?.qty).toBe(1);
    expect(cart.items[0]?.unitPrice).toBe('29.90');
    expect(cart.anonymousId).toBe('anon-session-0001');
    expect(cart.status).toBe('ACTIVE');
    expect(cart.currency).toBe('EUR');
  });

  it('reuses the existing active cart for the same anonymous session', async () => {
    const first = await addToCart(
      { variantId, qty: 1, anonymousId: 'anon-session-0001' },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );
    const second = await addToCart(
      { variantId, qty: 2, anonymousId: 'anon-session-0001' },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );
    expect(second.id).toBe(first.id);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.qty).toBe(3); // 1 + 2
  });

  it('adds a second distinct variant as a new line', async () => {
    const otherVariantId = 'vrntB0000000000000000000';
    variantRepo.setPrice(otherVariantId, 'EUR', '15.00');
    variantRepo.setStock(otherVariantId, 50);

    await addToCart(
      { variantId, qty: 1, anonymousId: 'anon-session-0001' },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );
    const cart = await addToCart(
      { variantId: otherVariantId, qty: 2, anonymousId: 'anon-session-0001' },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );

    expect(cart.items).toHaveLength(2);
    expect(cart.items.find((i) => i.variantId === variantId)?.qty).toBe(1);
    expect(cart.items.find((i) => i.variantId === otherVariantId)?.qty).toBe(2);
  });

  it('throws NotFoundError when the variant has no price for the requested currency', async () => {
    await expect(
      addToCart(
        { variantId, qty: 1, anonymousId: 'anon-session-0001' },
        { tenantId, currency: 'USD', cartRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws InventoryError when requested qty exceeds available stock', async () => {
    variantRepo.setStock(variantId, 3);
    await expect(
      addToCart(
        { variantId, qty: 10, anonymousId: 'anon-session-0001' },
        { tenantId, currency: 'EUR', cartRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  it('rejects invalid input via Zod (negative qty)', async () => {
    await expect(
      addToCart(
        { variantId, qty: -1, anonymousId: 'anon-session-0001' },
        { tenantId, currency: 'EUR', cartRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects input without either cartId or anonymousId', async () => {
    await expect(
      addToCart(
        { variantId, qty: 1 },
        { tenantId, currency: 'EUR', cartRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('uses the existing cartId when provided', async () => {
    const created = await cartRepo.create(tenantId, {
      currency: 'EUR',
      anonymousId: 'anon-session-0001',
    });
    const cart = await addToCart(
      { variantId, qty: 2, cartId: created.id },
      { tenantId, currency: 'EUR', cartRepo, variantRepo },
    );
    expect(cart.id).toBe(created.id);
    expect(cart.items[0]?.qty).toBe(2);
  });
});
