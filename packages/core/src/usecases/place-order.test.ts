import { beforeEach, describe, expect, it } from 'vitest';
import type { Cart, CartItem } from '@claudeshop/contracts/cart';
import type { Order, OrderStatus } from '@claudeshop/contracts/order';
import type { Variant } from '@claudeshop/contracts/product';
import { InventoryError, NotFoundError, ValidationError } from '@claudeshop/errors';
import type { CartRepository } from '../ports/cart-repository';
import type { InventoryRepository, StockReservation } from '../ports/inventory-repository';
import type { OrderRepository } from '../ports/order-repository';
import type { VariantRepository, VariantSummary } from '../ports/variant-repository';
import { placeOrder } from './place-order';

/** In-memory repositories scoped to these tests. */

class StubCartRepository implements CartRepository {
  public readonly carts = new Map<string, Cart>();
  public markOrderedCalls = 0;

  async findById(tenantId: string, id: string): Promise<Cart | null> {
    const c = this.carts.get(id);
    return c && c.tenantId === tenantId ? c : null;
  }
  async findActiveCart(): Promise<Cart | null> {
    return null;
  }
  async create(): Promise<Cart> {
    throw new Error('not used');
  }
  async addItem(): Promise<Cart> {
    throw new Error('not used');
  }
  async updateItemQty(tenantId: string, cartId: string, itemId: string, qty: number): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart || cart.tenantId !== tenantId) throw new NotFoundError(`Cart ${cartId}`);
    const items = qty === 0 ? cart.items.filter((i) => i.id !== itemId) : cart.items;
    const updated: Cart = { ...cart, items };
    this.carts.set(cartId, updated);
    return updated;
  }
  async removeItem(): Promise<Cart> {
    throw new Error('not used');
  }
  async getItems(tenantId: string, cartId: string): Promise<CartItem[]> {
    const c = await this.findById(tenantId, cartId);
    if (!c) throw new NotFoundError(`Cart ${cartId}`);
    return c.items;
  }
  async markOrdered(tenantId: string, cartId: string): Promise<Cart> {
    this.markOrderedCalls += 1;
    const c = this.carts.get(cartId);
    if (!c || c.tenantId !== tenantId) throw new NotFoundError(`Cart ${cartId}`);
    const updated: Cart = { ...c, status: 'ORDERED' };
    this.carts.set(cartId, updated);
    return updated;
  }

  /** Test helper — force cart status without passing through markOrdered. */
  forceStatus(cartId: string, status: Cart['status']): void {
    const c = this.carts.get(cartId);
    if (c) this.carts.set(cartId, { ...c, status });
  }
}

class StubOrderRepository implements OrderRepository {
  public readonly orders = new Map<string, Order>();

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const o = this.orders.get(id);
    return o && o.tenantId === tenantId ? o : null;
  }
  async findByNumber(tenantId: string, number: string): Promise<Order | null> {
    for (const o of this.orders.values()) {
      if (o.tenantId === tenantId && o.number === number) return o;
    }
    return null;
  }
  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: OrderStatus },
  ): Promise<{ items: Order[]; total: number }> {
    const all = [...this.orders.values()].filter(
      (o) => o.tenantId === tenantId && (!opts.status || o.status === opts.status),
    );
    return { items: all.slice(0, opts.limit), total: all.length };
  }
  async create(
    tenantId: string,
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Order> {
    const id = `ord${Math.random().toString(36).slice(2)}`.padEnd(24, '0').slice(0, 24);
    const now = new Date().toISOString();
    const created: Order = {
      ...order,
      tenantId,
      id,
      createdAt: now,
      updatedAt: now,
      lines: order.lines.map((l, i) => ({
        ...l,
        id: `ol${i}${Math.random().toString(36).slice(2)}`.padEnd(24, '0').slice(0, 24),
        orderId: id,
      })),
    };
    this.orders.set(id, created);
    return created;
  }
  async updateStatus(tenantId: string, id: string, status: OrderStatus): Promise<Order> {
    const o = this.orders.get(id);
    if (!o || o.tenantId !== tenantId) throw new NotFoundError(`Order ${id}`);
    const updated: Order = { ...o, status, updatedAt: new Date().toISOString() };
    this.orders.set(id, updated);
    return updated;
  }
}

class StubVariantRepository implements VariantRepository {
  private readonly summaries = new Map<string, VariantSummary>();

  setSummary(variantId: string, summary: Omit<VariantSummary, 'variantId'>): void {
    this.summaries.set(variantId, { variantId, ...summary });
  }

  async findById(): Promise<Variant | null> {
    return null;
  }
  async getSummary(_tenantId: string, variantId: string): Promise<VariantSummary | null> {
    return this.summaries.get(variantId) ?? null;
  }
  async getPriceFor(): Promise<string | null> {
    return null;
  }
  async getAvailableStock(): Promise<number> {
    return 1_000_000;
  }
}

class StubInventoryRepository implements InventoryRepository {
  public reservations: StockReservation[] = [];
  public released: StockReservation[] = [];
  public committed: StockReservation[] = [];
  public throwOnReserve = false;

  async reserveStock(_tenantId: string, reservations: StockReservation[]): Promise<void> {
    if (this.throwOnReserve) {
      throw new InventoryError('Out of stock', { details: { reservations } });
    }
    this.reservations.push(...reservations);
  }
  async releaseStock(_tenantId: string, releases: StockReservation[]): Promise<void> {
    this.released.push(...releases);
  }
  async commitReservation(_tenantId: string, commits: StockReservation[]): Promise<void> {
    this.committed.push(...commits);
  }
}

class FailingOrderRepository extends StubOrderRepository {
  public override async create(): Promise<Order> {
    throw new Error('simulated DB failure');
  }
}

describe('placeOrder use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const cartId = 'cartA000000000000000000000';
  const variantA = 'vrntA0000000000000000000';
  const variantB = 'vrntB0000000000000000000';

  let cartRepo: StubCartRepository;
  let orderRepo: StubOrderRepository;
  let variantRepo: StubVariantRepository;

  function seedCart(items: Array<{ variantId: string; qty: number; unitPrice: string }>): void {
    const now = new Date().toISOString();
    const cart: Cart = {
      id: cartId,
      tenantId,
      customerId: null,
      anonymousId: 'anon-001',
      currency: 'EUR',
      status: 'ACTIVE',
      expiresAt: null,
      items: items.map((item, idx) => ({
        id: `ci${idx}`.padEnd(24, '0'),
        cartId,
        variantId: item.variantId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    cartRepo.carts.set(cartId, cart);
  }

  beforeEach(() => {
    cartRepo = new StubCartRepository();
    orderRepo = new StubOrderRepository();
    variantRepo = new StubVariantRepository();
    variantRepo.setSummary(variantA, { sku: 'HCS-TEE-S', productName: 'Hello ClaudeShop Tee' });
    variantRepo.setSummary(variantB, { sku: 'HCS-MUG', productName: 'ClaudeShop Mug' });
  });

  it('creates an order from a valid active cart and returns it PENDING_PAYMENT', async () => {
    seedCart([
      { variantId: variantA, qty: 2, unitPrice: '29.90' },
      { variantId: variantB, qty: 1, unitPrice: '15.00' },
    ]);

    const order = await placeOrder(
      { cartId, customerEmail: 'demo@claudeshop.local' },
      { tenantId, cartRepo, orderRepo, variantRepo, numberPrefix: 'CS' },
    );

    expect(order.tenantId).toBe(tenantId);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.currency).toBe('EUR');
    expect(order.lines).toHaveLength(2);
    expect(order.anonymousEmail).toBe('demo@claudeshop.local');
    expect(order.customerId).toBeNull();
  });

  it('computes the subtotal and total correctly (no tax/discount/shipping in Phase 2)', async () => {
    seedCart([
      { variantId: variantA, qty: 2, unitPrice: '29.90' }, // 59.80
      { variantId: variantB, qty: 1, unitPrice: '15.00' }, // 15.00
    ]);

    const order = await placeOrder(
      { cartId },
      { tenantId, cartRepo, orderRepo, variantRepo, numberPrefix: 'CS' },
    );

    expect(order.totals.subtotal).toBe('74.80');
    expect(order.totals.tax).toBe('0.00');
    expect(order.totals.discount).toBe('0.00');
    expect(order.totals.shipping).toBe('0.00');
    expect(order.totals.total).toBe('74.80');
  });

  it('enriches each order line with productName + sku from VariantRepository', async () => {
    seedCart([
      { variantId: variantA, qty: 1, unitPrice: '29.90' },
      { variantId: variantB, qty: 2, unitPrice: '15.00' },
    ]);

    const order = await placeOrder(
      { cartId },
      { tenantId, cartRepo, orderRepo, variantRepo, numberPrefix: 'CS' },
    );

    const lineA = order.lines.find((l) => l.variantId === variantA);
    const lineB = order.lines.find((l) => l.variantId === variantB);

    expect(lineA?.sku).toBe('HCS-TEE-S');
    expect(lineA?.productName).toBe('Hello ClaudeShop Tee');
    expect(lineB?.sku).toBe('HCS-MUG');
    expect(lineB?.productName).toBe('ClaudeShop Mug');
  });

  it('falls back to empty strings when VariantRepository omits a summary', async () => {
    const unknownVariant = 'vrntZ0000000000000000000';
    seedCart([{ variantId: unknownVariant, qty: 1, unitPrice: '10.00' }]);

    const order = await placeOrder(
      { cartId },
      { tenantId, cartRepo, orderRepo, variantRepo, numberPrefix: 'CS' },
    );

    expect(order.lines[0]?.sku).toBe('');
    expect(order.lines[0]?.productName).toBe('');
  });

  it('marks the source cart as ORDERED once the order is placed', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '29.90' }]);

    await placeOrder(
      { cartId },
      { tenantId, cartRepo, orderRepo, variantRepo, numberPrefix: 'CS' },
    );

    expect(cartRepo.markOrderedCalls).toBe(1);
    const stored = await cartRepo.findById(tenantId, cartId);
    expect(stored?.status).toBe('ORDERED');
  });

  it('generates a sequential order number with the configured prefix', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '10.00' }]);

    const order = await placeOrder(
      { cartId },
      {
        tenantId,
        cartRepo,
        orderRepo,
        variantRepo,
        numberPrefix: 'CS',
        sequence: async () => 42,
      },
    );

    expect(order.number).toBe('CS-000042');
  });

  it('throws NotFoundError when the cart does not exist', async () => {
    await expect(
      placeOrder(
        { cartId: 'cart000notfound000000000' },
        { tenantId, cartRepo, orderRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when the cart is empty', async () => {
    seedCart([]);
    await expect(
      placeOrder({ cartId }, { tenantId, cartRepo, orderRepo, variantRepo }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when the cart is not ACTIVE', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '10.00' }]);
    cartRepo.forceStatus(cartId, 'ORDERED');

    await expect(
      placeOrder({ cartId }, { tenantId, cartRepo, orderRepo, variantRepo }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid input via Zod (bad cartId format)', async () => {
    await expect(
      placeOrder(
        { cartId: 'not-a-cuid' } as unknown as { cartId: string },
        { tenantId, cartRepo, orderRepo, variantRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // ----- Inventory reservation (Phase 2.4) --------------------------------

  it('reserves stock when inventoryRepo is provided, collapsing per variant', async () => {
    seedCart([
      { variantId: variantA, qty: 2, unitPrice: '10.00' },
      { variantId: variantA, qty: 3, unitPrice: '10.00' }, // same variant, merged
      { variantId: variantB, qty: 1, unitPrice: '5.00' },
    ]);
    const inventoryRepo = new StubInventoryRepository();

    await placeOrder(
      { cartId },
      { tenantId, cartRepo, orderRepo, variantRepo, inventoryRepo, numberPrefix: 'CS' },
    );

    expect(inventoryRepo.reservations).toHaveLength(2);
    expect(inventoryRepo.reservations).toEqual(
      expect.arrayContaining([
        { variantId: variantA, qty: 5 },
        { variantId: variantB, qty: 1 },
      ]),
    );
    expect(inventoryRepo.released).toHaveLength(0);
  });

  it('propagates InventoryError from reserveStock without creating an order', async () => {
    seedCart([{ variantId: variantA, qty: 100, unitPrice: '10.00' }]);
    const inventoryRepo = new StubInventoryRepository();
    inventoryRepo.throwOnReserve = true;

    await expect(
      placeOrder(
        { cartId },
        { tenantId, cartRepo, orderRepo, variantRepo, inventoryRepo, numberPrefix: 'CS' },
      ),
    ).rejects.toBeInstanceOf(InventoryError);

    expect(orderRepo.orders.size).toBe(0);
    expect(cartRepo.markOrderedCalls).toBe(0);
  });

  it('releases the reservation when order creation fails', async () => {
    seedCart([{ variantId: variantA, qty: 2, unitPrice: '10.00' }]);
    const inventoryRepo = new StubInventoryRepository();
    const failingOrderRepo = new FailingOrderRepository();

    await expect(
      placeOrder(
        { cartId },
        {
          tenantId,
          cartRepo,
          orderRepo: failingOrderRepo,
          variantRepo,
          inventoryRepo,
          numberPrefix: 'CS',
        },
      ),
    ).rejects.toThrow('simulated DB failure');

    expect(inventoryRepo.reservations).toEqual([{ variantId: variantA, qty: 2 }]);
    expect(inventoryRepo.released).toEqual([{ variantId: variantA, qty: 2 }]);
  });

  // --- Phase 8.1 — tax + shipping at checkout -----------------------------

  it('applies a shipping rate by id and stamps shipping on totals', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '50.00' }]);
    const shippingRateRepo = new InMemoryShippingRateRepo();
    shippingRateRepo.seed({
      id: 'shr10000000000000000000001',
      tenantId,
      name: 'EU Standard',
      countryCodes: ['FR', 'DE'],
      currency: 'EUR',
      basePriceCents: 700,
      minSubtotalCents: null,
      freeShippingAboveCents: null,
      estimatedDays: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = await placeOrder(
      {
        cartId,
        shippingRateId: 'shr10000000000000000000001',
        shippingAddress: { country: 'FR' },
      },
      {
        tenantId,
        cartRepo,
        orderRepo,
        variantRepo,
        shippingRateRepo,
        numberPrefix: 'CS',
      },
    );
    expect(order.totals.shipping).toBe('7.00');
    expect(order.totals.subtotal).toBe('50.00');
    expect(order.totals.total).toBe('57.00');
  });

  it('zeroes shipping when basket exceeds freeShippingAboveCents', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '120.00' }]);
    const shippingRateRepo = new InMemoryShippingRateRepo();
    shippingRateRepo.seed({
      id: 'shr10000000000000000000002',
      tenantId,
      name: 'EU Standard',
      countryCodes: ['FR'],
      currency: 'EUR',
      basePriceCents: 700,
      minSubtotalCents: null,
      freeShippingAboveCents: 10_000,
      estimatedDays: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = await placeOrder(
      {
        cartId,
        shippingRateId: 'shr10000000000000000000002',
        shippingAddress: { country: 'FR' },
      },
      {
        tenantId,
        cartRepo,
        orderRepo,
        variantRepo,
        shippingRateRepo,
        numberPrefix: 'CS',
      },
    );
    expect(order.totals.shipping).toBe('0.00');
    expect(order.totals.total).toBe('120.00');
  });

  it('rejects a shipping rate whose currency does not match cart currency', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '50.00' }]);
    const shippingRateRepo = new InMemoryShippingRateRepo();
    shippingRateRepo.seed({
      id: 'shr10000000000000000000003',
      tenantId,
      name: 'US Standard',
      countryCodes: ['US'],
      currency: 'USD',
      basePriceCents: 1000,
      minSubtotalCents: null,
      freeShippingAboveCents: null,
      estimatedDays: 5,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await expect(
      placeOrder(
        {
          cartId,
          shippingRateId: 'shr10000000000000000000003',
          shippingAddress: { country: 'US' },
        },
        {
          tenantId,
          cartRepo,
          orderRepo,
          variantRepo,
          shippingRateRepo,
          numberPrefix: 'CS',
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('applies the highest-priority matching tax rate to subtotal + shipping', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '50.00' }]);
    const shippingRateRepo = new InMemoryShippingRateRepo();
    shippingRateRepo.seed({
      id: 'shr10000000000000000000004',
      tenantId,
      name: 'EU Standard',
      countryCodes: ['FR'],
      currency: 'EUR',
      basePriceCents: 1000,
      minSubtotalCents: null,
      freeShippingAboveCents: null,
      estimatedDays: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const taxRateRepo = new InMemoryTaxRateRepo();
    taxRateRepo.seed({
      id: 'tax10000000000000000000001',
      tenantId,
      name: 'VAT 20% (FR)',
      countryCode: 'FR',
      regionCode: null,
      postcodePattern: null,
      rateBp: 2000,
      priority: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = await placeOrder(
      {
        cartId,
        shippingRateId: 'shr10000000000000000000004',
        shippingAddress: { country: 'FR' },
      },
      {
        tenantId,
        cartRepo,
        orderRepo,
        variantRepo,
        shippingRateRepo,
        taxRateRepo,
        numberPrefix: 'CS',
      },
    );
    // (50 + 10) * 20% = 12.00
    expect(order.totals.tax).toBe('12.00');
    expect(order.totals.shipping).toBe('10.00');
    expect(order.totals.total).toBe('72.00');
  });

  it('falls back to no tax when no tax rate matches the destination', async () => {
    seedCart([{ variantId: variantA, qty: 1, unitPrice: '50.00' }]);
    const taxRateRepo = new InMemoryTaxRateRepo();
    // FR-only rule, but the basket ships to US.
    taxRateRepo.seed({
      id: 'tax20000000000000000000002',
      tenantId,
      name: 'VAT 20% (FR)',
      countryCode: 'FR',
      regionCode: null,
      postcodePattern: null,
      rateBp: 2000,
      priority: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = await placeOrder(
      { cartId, shippingAddress: { country: 'US' } },
      {
        tenantId,
        cartRepo,
        orderRepo,
        variantRepo,
        taxRateRepo,
        numberPrefix: 'CS',
      },
    );
    expect(order.totals.tax).toBe('0.00');
    expect(order.totals.total).toBe('50.00');
  });
});

// --- Phase 8.1 in-memory repos ------------------------------------------

class InMemoryShippingRateRepo {
  private readonly rows = new Map<string, import('@claudeshop/contracts/checkout').ShippingRate>();
  seed(rate: import('@claudeshop/contracts/checkout').ShippingRate): void {
    this.rows.set(rate.id, rate);
  }
  async findById(
    tenantId: string,
    id: string,
  ): Promise<import('@claudeshop/contracts/checkout').ShippingRate | null> {
    const r = this.rows.get(id);
    return r && r.tenantId === tenantId ? r : null;
  }
  async list(): Promise<{
    items: import('@claudeshop/contracts/checkout').ShippingRate[];
    total: number;
  }> {
    return { items: [], total: 0 };
  }
  async create(): Promise<import('@claudeshop/contracts/checkout').ShippingRate> {
    throw new Error('not used');
  }
  async update(): Promise<import('@claudeshop/contracts/checkout').ShippingRate> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    /* noop */
  }
  async findApplicable(): Promise<import('@claudeshop/contracts/checkout').ShippingRate[]> {
    return [];
  }
}

class InMemoryTaxRateRepo {
  private readonly rows = new Map<string, import('@claudeshop/contracts/checkout').TaxRate>();
  seed(rate: import('@claudeshop/contracts/checkout').TaxRate): void {
    this.rows.set(rate.id, rate);
  }
  async findById(): Promise<import('@claudeshop/contracts/checkout').TaxRate | null> {
    return null;
  }
  async list(): Promise<{
    items: import('@claudeshop/contracts/checkout').TaxRate[];
    total: number;
  }> {
    return { items: [], total: 0 };
  }
  async create(): Promise<import('@claudeshop/contracts/checkout').TaxRate> {
    throw new Error('not used');
  }
  async update(): Promise<import('@claudeshop/contracts/checkout').TaxRate> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    /* noop */
  }
  async findApplicable(
    _tenantId: string,
    address: { country: string; region?: string; postcode?: string },
  ): Promise<import('@claudeshop/contracts/checkout').TaxRate[]> {
    return [...this.rows.values()]
      .filter((r) => r.isActive && r.countryCode === address.country)
      .sort((a, b) => b.priority - a.priority);
  }
}
