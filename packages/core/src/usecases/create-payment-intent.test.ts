import { beforeEach, describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '@claudeshop/contracts/order';
import { NotFoundError, PaymentError, ValidationError } from '@claudeshop/errors';
import type { OrderRepository } from '../ports/order-repository';
import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProvider,
  PaymentProviderEvent,
} from '../ports/payment-provider';
import { createPaymentIntent } from './create-payment-intent';

class StubOrderRepository implements OrderRepository {
  public readonly orders = new Map<string, Order>();

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
  async create(tenantId: string, order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const id = `ord${Math.random().toString(36).slice(2)}`.padEnd(24, '0').slice(0, 24);
    const now = new Date().toISOString();
    const created: Order = {
      ...order,
      tenantId,
      id,
      createdAt: now,
      updatedAt: now,
      lines: [],
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

class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  public readonly intents: Array<{ input: CreateIntentInput; idempotencyKey: string }> = [];
  public throwOnCreate = false;

  async createIntent(
    input: CreateIntentInput,
    idempotencyKey: string,
  ): Promise<CreateIntentResult> {
    if (this.throwOnCreate) {
      throw new PaymentError('Provider rejected the intent');
    }
    this.intents.push({ input, idempotencyKey });
    return {
      providerRef: `fake_pi_${idempotencyKey}`,
      clientSecret: `fake_secret_${idempotencyKey}`,
      status: 'PENDING',
    };
  }

  async refund(): Promise<{
    refundId: string;
    amount: string;
    currency: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  }> {
    return { refundId: 'fake_re', amount: '0.00', currency: 'EUR', status: 'SUCCEEDED' };
  }

  async verifyWebhook(): Promise<PaymentProviderEvent | null> {
    return null;
  }
}

describe('createPaymentIntent use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let orderRepo: StubOrderRepository;
  let paymentProvider: FakePaymentProvider;

  function seedOrder(overrides: Partial<Order> = {}): Order {
    const id = 'ord01h000000000000000demo';
    const now = new Date().toISOString();
    const order: Order = {
      id,
      tenantId,
      number: 'CS-000042',
      customerId: null,
      anonymousEmail: 'demo@claudeshop.local',
      status: 'PENDING_PAYMENT',
      currency: 'EUR',
      totals: {
        subtotal: '74.80',
        tax: '0.00',
        discount: '0.00',
        shipping: '0.00',
        total: '74.80',
      },
      lines: [],
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
  });

  it('creates an intent for a PENDING_PAYMENT order and returns the client secret', async () => {
    const order = seedOrder();

    const result = await createPaymentIntent(
      { orderId: order.id },
      { tenantId, orderRepo, paymentProvider },
    );

    expect(result.orderId).toBe(order.id);
    expect(result.orderNumber).toBe('CS-000042');
    expect(result.amount).toBe('74.80');
    expect(result.currency).toBe('EUR');
    expect(result.providerRef).toContain('fake_pi_order:');
    expect(result.clientSecret).toContain('fake_secret_order:');
  });

  it('passes the order id + idempotency key to the provider', async () => {
    const order = seedOrder();

    await createPaymentIntent(
      { orderId: order.id },
      { tenantId, orderRepo, paymentProvider },
    );

    expect(paymentProvider.intents).toHaveLength(1);
    expect(paymentProvider.intents[0]?.idempotencyKey).toBe(`order:${order.id}:pay`);
    expect(paymentProvider.intents[0]?.input.amount).toBe('74.80');
    expect(paymentProvider.intents[0]?.input.currency).toBe('EUR');
    expect(paymentProvider.intents[0]?.input.customerEmail).toBe('demo@claudeshop.local');
    expect(paymentProvider.intents[0]?.input.metadata?.orderNumber).toBe('CS-000042');
  });

  it('throws NotFoundError when the order does not exist', async () => {
    await expect(
      createPaymentIntent(
        { orderId: 'ord01h000000000000notfnd' },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws PaymentError when the order is not PENDING_PAYMENT', async () => {
    const order = seedOrder({ status: 'PAID' });

    await expect(
      createPaymentIntent(
        { orderId: order.id },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(PaymentError);
  });

  it('propagates provider errors as PaymentError', async () => {
    const order = seedOrder();
    paymentProvider.throwOnCreate = true;

    await expect(
      createPaymentIntent(
        { orderId: order.id },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(PaymentError);
  });

  it('rejects invalid input via Zod', async () => {
    await expect(
      createPaymentIntent(
        { orderId: 'not-a-cuid' } as { orderId: string },
        { tenantId, orderRepo, paymentProvider },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
