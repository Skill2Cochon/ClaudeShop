import { describe, expect, it, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookSubscription,
} from '@claudeshop/contracts/webhook';
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../ports/http-client';
import type {
  CreateWebhookDeliveryInput,
  RecordAttemptInput,
  WebhookDeliveryRepository,
} from '../ports/webhook-delivery-repository';
import type { WebhookSubscriptionRepository } from '../ports/webhook-subscription-repository';
import type { Clock } from '../ports/clock';
import { dispatchWebhookEvent } from './dispatch-webhook-event';

class InMemorySubscriptionRepo implements WebhookSubscriptionRepository {
  private readonly rows = new Map<string, WebhookSubscription>();
  private counter = 0;

  seed(s: Partial<WebhookSubscription> & { tenantId: string; url: string; events: string[] }): WebhookSubscription {
    this.counter++;
    const now = new Date().toISOString();
    const sub: WebhookSubscription = {
      id: s.id ?? `sub${String(this.counter).padStart(22, '0')}`,
      tenantId: s.tenantId,
      url: s.url,
      secret: s.secret ?? 'test-secret-1234567890',
      events: s.events,
      isActive: s.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(sub.id, sub);
    return sub;
  }

  async findById(tenantId: string, id: string): Promise<WebhookSubscription | null> {
    const r = this.rows.get(id);
    return r && r.tenantId === tenantId ? r : null;
  }
  async list(): Promise<{ items: WebhookSubscription[]; total: number }> {
    return { items: [], total: 0 };
  }
  async findActiveForEvent(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookSubscription[]> {
    return [...this.rows.values()].filter(
      (s) => s.tenantId === tenantId && s.isActive && s.events.includes(eventType),
    );
  }
  async create(
    _tenantId: string,
    _input: CreateWebhookSubscriptionInput & { secret: string },
  ): Promise<WebhookSubscription> {
    throw new Error('not used');
  }
  async update(
    _tenantId: string,
    _id: string,
    _input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    /* noop */
  }
}

class InMemoryDeliveryRepo implements WebhookDeliveryRepository {
  private readonly byKey = new Map<string, WebhookDelivery>();
  private counter = 0;

  async findById(_tenantId: string, id: string): Promise<WebhookDelivery | null> {
    for (const r of this.byKey.values()) {
      if (r.id === id) return r;
    }
    return null;
  }
  async list(): Promise<{ items: WebhookDelivery[]; total: number }> {
    return { items: [...this.byKey.values()], total: this.byKey.size };
  }
  async upsert(
    tenantId: string,
    input: CreateWebhookDeliveryInput,
  ): Promise<{ delivery: WebhookDelivery; isNew: boolean }> {
    const key = `${input.subscriptionId}:${input.eventId}`;
    const existing = this.byKey.get(key);
    if (existing) return { delivery: existing, isNew: false };
    this.counter++;
    const now = new Date().toISOString();
    const delivery: WebhookDelivery = {
      id: `del${String(this.counter).padStart(22, '0')}`,
      tenantId,
      subscriptionId: input.subscriptionId,
      eventType: input.eventType,
      eventId: input.eventId,
      payload: input.payload,
      status: 'PENDING',
      attemptCount: 0,
      lastAttemptAt: null,
      deliveredAt: null,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      createdAt: now,
    };
    this.byKey.set(key, delivery);
    return { delivery, isNew: true };
  }
  async recordAttempt(
    _tenantId: string,
    id: string,
    attempt: RecordAttemptInput,
  ): Promise<WebhookDelivery> {
    for (const [key, r] of this.byKey) {
      if (r.id === id) {
        const updated: WebhookDelivery = {
          ...r,
          status: attempt.status,
          attemptCount: r.attemptCount + 1,
          lastAttemptAt: attempt.attemptedAt.toISOString(),
          deliveredAt: attempt.deliveredAt
            ? attempt.deliveredAt.toISOString()
            : r.deliveredAt,
          responseStatus: attempt.responseStatus ?? r.responseStatus,
          responseBody: attempt.responseBody ?? r.responseBody,
          errorMessage: attempt.errorMessage ?? r.errorMessage,
        };
        this.byKey.set(key, updated);
        return updated;
      }
    }
    throw new Error(`Delivery ${id} not found`);
  }
}

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

class RecordingHttp implements HttpClient {
  public requests: HttpRequest[] = [];
  constructor(private readonly response: HttpResponse | (() => Promise<HttpResponse>)) {}
  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    if (typeof this.response === 'function') return this.response();
    return this.response;
  }
}

class ThrowingHttp implements HttpClient {
  constructor(private readonly message: string) {}
  async send(): Promise<never> {
    throw new Error(this.message);
  }
}

const tenantId = 'tnt01h0000000000000000000';
const clock = new FixedClock(new Date('2026-04-19T12:00:00.000Z'));

describe('dispatchWebhookEvent', () => {
  let subRepo: InMemorySubscriptionRepo;
  let deliveryRepo: InMemoryDeliveryRepo;

  beforeEach(() => {
    subRepo = new InMemorySubscriptionRepo();
    deliveryRepo = new InMemoryDeliveryRepo();
  });

  it('fans out to every active subscription that listens for the event', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'] });
    subRepo.seed({ tenantId, url: 'https://b.example/hook', events: ['order.placed'] });
    subRepo.seed({ tenantId, url: 'https://c.example/hook', events: ['order.shipped'] });

    const http = new RecordingHttp({ status: 200, body: 'ok' });
    const result = await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp1', payload: { orderId: 'cmp1' } },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );

    expect(result.fanout).toBe(2);
    expect(http.requests.map((r) => r.url).sort()).toEqual([
      'https://a.example/hook',
      'https://b.example/hook',
    ]);
    expect(result.deliveries.every((d) => d.status === 'DELIVERED')).toBe(true);
  });

  it('skips inactive subscriptions and unrelated topics', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'], isActive: false });
    subRepo.seed({ tenantId, url: 'https://b.example/hook', events: ['order.shipped'] });

    const http = new RecordingHttp({ status: 200, body: '' });
    const result = await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp2', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(result.fanout).toBe(0);
    expect(http.requests).toHaveLength(0);
  });

  it('signs the body with HMAC-SHA256 and surfaces traceability headers', async () => {
    subRepo.seed({
      tenantId,
      url: 'https://a.example/hook',
      events: ['order.placed'],
      secret: 'super-secret-1234567890',
    });
    const http = new RecordingHttp({ status: 200, body: 'ok' });
    await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp3', payload: { orderId: 'cmp3' } },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    const req = http.requests[0]!;
    const expected = createHmac('sha256', 'super-secret-1234567890')
      .update(req.body, 'utf8')
      .digest('hex');
    expect(req.headers['x-claudeshop-signature']).toBe(`sha256=${expected}`);
    expect(req.headers['x-claudeshop-event']).toBe('order.placed');
    expect(req.headers['x-claudeshop-delivery']).toMatch(/^del/);
    expect(req.headers['content-type']).toBe('application/json');
  });

  it('marks the delivery FAILED on non-2xx responses with response body recorded', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'] });
    const http = new RecordingHttp({ status: 503, body: 'service unavailable' });
    const result = await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp4', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(result.deliveries[0]?.status).toBe('FAILED');
    expect(result.deliveries[0]?.responseStatus).toBe(503);
    expect(result.deliveries[0]?.responseBody).toContain('service unavailable');
  });

  it('marks the delivery FAILED with errorMessage when the HTTP client throws', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'] });
    const http = new ThrowingHttp('connect ETIMEDOUT');
    const result = await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp5', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(result.deliveries[0]?.status).toBe('FAILED');
    expect(result.deliveries[0]?.errorMessage).toContain('ETIMEDOUT');
  });

  it('is idempotent on (subscription, eventId): repeating a successful dispatch is a no-op', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'] });
    const http = new RecordingHttp({ status: 200, body: '' });
    await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp6', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(http.requests).toHaveLength(1);

    await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp6', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(http.requests).toHaveLength(1); // not re-POSTed
  });

  it('retries a previously-FAILED delivery on a subsequent dispatch', async () => {
    subRepo.seed({ tenantId, url: 'https://a.example/hook', events: ['order.placed'] });
    let nextStatus = 500;
    const http: HttpClient = {
      send: async () => ({ status: nextStatus, body: '' }),
    };
    await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp7', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    nextStatus = 200;
    const second = await dispatchWebhookEvent(
      { eventType: 'order.placed', eventId: 'order:cmp7', payload: {} },
      { tenantId, subscriptionRepo: subRepo, deliveryRepo, http, clock },
    );
    expect(second.deliveries[0]?.status).toBe('DELIVERED');
    expect(second.deliveries[0]?.attemptCount).toBe(2);
  });
});
