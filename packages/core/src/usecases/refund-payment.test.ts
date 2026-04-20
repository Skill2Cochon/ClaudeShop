import { beforeEach, describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '@claudeshop/contracts/order';
import { NotFoundError, PaymentError, ValidationError } from '@claudeshop/errors';
import type { InventoryRepository, StockReservation } from '../ports/inventory-repository';
import type { OrderRepository } from '../ports/order-repository';
import type {
  PaymentProvider,
  PaymentProviderEvent,
  RefundInput,
  RefundResult,
} from '../ports/payment-provider';
import { refundPayment } from './refund-payment';

class StubOrderRepository implements OrderRepository {
  public readonly orders = new Map<string, Order>();
  public readonly statusUpdates: Array<{ id: string; status: OrderStatus }> = [];

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const o = this.orders.get(id);
    return o && o.tenantId === tenantId ? o : null;
  }
  async findByNumber(): Promise<Order | null> {
    return null;
  }
  async list(): Promise<{ items: Order[]; total: number }> {
    return { items: [], total: 0 };
  }
  async create(): Promise<Order> {
    throw new Error('not used');
  }
  async updateStatus(tenantId: string, id: string, status: OrderStatus): Promise<Order> {
    const o = this.orders.get(id);
    if (!o || o.tenantId !== tenantId) throw new NotFoundError(`Order ${id}`);
    const updated: Order = { ...o, status, updatedAt: new Date().toISOString() };
    this.orders.set(id, updated);
    this.statusUpdates.push({ id, status });
    return updated;
  }
}

class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  public readonly refunds: Array<{ input: RefundInput; idempotencyKey: string }> = [];
  public throwOnRefund = false;

  async createIntent(): Promise<{
    providerRef: string;
    clientSecret: string;
    status: 'PENDING';
  }> {
    return { providerRef: '', clientSecret: '', status: 'PENDING' };
  }
  async refund(input: RefundInput, idempotencyKey: string): Promise<RefundResult> {
    if (this.throwOnRefund) {
      throw new PaymentError('Provider rejected the refund');
    }
    this.refunds.push({ input, idempotencyKey });
    return {
      refundId: `fake_re_${idempotencyKey}`,
      amount: input.amount ?? '0.00',
      currency: 'EUR',
      status: 'SUCCEEDED',
    };
  }
  async verifyWebhook(): Promise<PaymentProviderEvent | null> {
    return null;
  }
}

class StubInventoryRepository implements InventoryRepository {
  public readonly released: StockReservation[] = [];
  async reserveStock(): Promise<void> {}
  async releaseStock(_tenantId: string, releases: StockReservation[]): Promise<void> {
    this.released.push(...releases);
  }
  async commitReservation(): Promise<void> {}
}

describe('refundPayment use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const providerRef = 'pi_test_1234567890';
  let orderRepo: StubOrderRepository;
  let paymentProvider: FakePaymentProvider;
  let inventoryRepo: StubInventoryRepository;

  function seedOrder(overrides: Partial<Order> = {}): Order {
    const id = 'ord01h000000000000000demo';
    const now = new Date().toISOString();
    const order: Order = {
      id,
      tenantId,
      number: 'CS-000042',
      customerId: null,
      anonymousEmail: 'demo@claudeshop.local',
      status: 'PAID',
      currency: 'EUR',
      totals: {
        subtotal: '74.80',
        tax: '0.00',
        discount: '0.00',
        shipping: '0.00',
        total: '74.80',
      },
      lines: [
        {
          id: 'ol1',
          orderId: id,
          variantId: 'vrntA0000000000000000000',
          productName: 'Tee S',
          sku: 'HCS-TEE-S',
          qty: 2,
          unitPrice: '29.90',
          subtotal: '59.80',
          tax: '0.00',
          discount: '0.00',
          total: '59.80',
        },
        {
          id: 'ol2',
          orderId: id,
          variantId: 'vrntB0000000000000000000',
          productName: 'Mug',
          sku: 'HCS-MUG',
          qty: 1,
          unitPrice: '15.00',
          subtotal: '15.00',
          tax: '0.00',
          discount: '0.00',
          total: '15.00',
        },
      ],
      placedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
    orderRepo.orders.set(id, order);
    return order;
  }

  beforeEach(() => {
    orderRepo = new StubOrderRepository();
    paymentProvider = new FakePaymentProvider();
    inventoryRepo = new StubInventoryRepository();
  });

  it('refunds the full order and transitions status to REFUNDED', async () => {
    const order = seedOrder();

    const result = await refundPayment(
      { orderId: order.id, providerRef },
      { tenantId, orderRepo, paymentProvider, sequence: async () => 1 },
    );

    expect(result.isFullRefund).toBe(true);
    expect(result.amount).toBe('74.80');
    expect(result.refundId).toContain('fake_re_order:');
    expect(orderRepo.statusUpdates).toEqual([{ id: order.id, status: 'REFUNDED' }]);
  });

  it('does NOT change status for a partial refund', async () => {
    const order = seedOrder();

    const result = await refundPayment(
      { orderId: order.id, amount: '10.00', providerRef },
      { tenantId, orderRepo, paymentProvider, sequence: async () => 1 },
    );

    expect(result.isFullRefund).toBe(false);
    expect(result.amount).toBe('10.00');
    expect(orderRepo.statusUpdates).toEqual([]);
    expect(orderRepo.orders.get(order.id)?.status).toBe('PAID');
  });

  it('releases inventory on full refund of a PAID (not yet shipped) order', async () => {
    const order = seedOrder({ status: 'PAID' });

    await refundPayment(
      { orderId: order.id, providerRef },
      { tenantId, orderRepo, paymentProvider, inventoryRepo, sequence: async () => 1 },
    );

    expect(inventoryRepo.released).toHaveLength(2);
    expect(inventoryRepo.released).toEqual(
      expect.arrayContaining([
        { variantId: 'vrntA0000000000000000000', qty: 2 },
        { variantId: 'vrntB0000000000000000000', qty: 1 },
      ]),
    );
  });

  it('does NOT release inventory for a SHIPPED order (stock already committed)', async () => {
    const order = seedOrder({ status: 'SHIPPED' });

    await refundPayment(
      { orderId: order.id, providerRef },
      { tenantId, orderRepo, paymentProvider, inventoryRepo, sequence: async () => 1 },
    );

    expect(inventoryRepo.released).toHaveLength(0);
  });

  it('passes an order-scoped idempotency key to the provider', async () => {
    const order = seedOrder();

    await refundPayment(
      { orderId: order.id, providerRef },
      { tenantId, orderRepo, paymentProvider, sequence: async () => 42 },
    );

    expect(paymentProvider.refunds).toHaveLength(1);
    expect(paymentProvider.refunds[0]?.idempotencyKey).toBe(`order:${order.id}:refund:42`);
    expect(paymentProvider.refunds[0]?.input.providerRef).toBe(providerRef);
    expect(paymentProvider.refunds[0]?.input.metadata?.orderId).toBe(order.id);
  });

  it('throws NotFoundError when the order does not exist', async () => {
    await expect(
      refundPayment(
        { orderId: 'ord01h0000notfound0000000', providerRef },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws PaymentError when the order status is not refundable', async () => {
    const order = seedOrder({ status: 'PENDING_PAYMENT' });

    await expect(
      refundPayment(
        { orderId: order.id, providerRef },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(PaymentError);
  });

  it('throws ValidationError when refund amount exceeds order total', async () => {
    const order = seedOrder();

    await expect(
      refundPayment(
        { orderId: order.id, amount: '100.00', providerRef },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('propagates provider failure as PaymentError', async () => {
    const order = seedOrder();
    paymentProvider.throwOnRefund = true;

    await expect(
      refundPayment(
        { orderId: order.id, providerRef },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(PaymentError);

    // Order status unchanged on provider failure.
    expect(orderRepo.orders.get(order.id)?.status).toBe('PAID');
  });

  it('rejects invalid input via Zod', async () => {
    await expect(
      refundPayment(
        { orderId: 'not-a-cuid', providerRef } as { orderId: string; providerRef: string },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('requires a providerRef (clear error message)', async () => {
    const order = seedOrder();

    await expect(
      refundPayment(
        { orderId: order.id } as { orderId: string; providerRef: string },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
