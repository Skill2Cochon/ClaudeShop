import { describe, expect, it, beforeEach, vi } from 'vitest';
import { InMemoryIdempotencyStore } from './in-memory-idempotency-store';

describe('InMemoryIdempotencyStore', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const key = 'idem-key-12345678';
  const route = 'POST /v1/orders';

  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
    vi.useRealTimers();
  });

  it('returns null when no record exists', async () => {
    expect(await store.get(tenantId, key, route)).toBeNull();
  });

  it('saves and retrieves a record by (tenantId, key, route)', async () => {
    await store.save(tenantId, key, route, {
      requestHash: 'abc123',
      responseStatus: 201,
      responseBody: { data: { orderId: 'ord1' } },
    });

    const record = await store.get(tenantId, key, route);
    expect(record).not.toBeNull();
    expect(record?.requestHash).toBe('abc123');
    expect(record?.responseStatus).toBe(201);
    expect(record?.responseBody).toEqual({ data: { orderId: 'ord1' } });
  });

  it('scopes records per tenant', async () => {
    await store.save(tenantId, key, route, {
      requestHash: 'abc',
      responseStatus: 200,
      responseBody: {},
    });
    expect(await store.get('tnt-other', key, route)).toBeNull();
  });

  it('scopes records per route', async () => {
    await store.save(tenantId, key, 'POST /v1/orders', {
      requestHash: 'abc',
      responseStatus: 200,
      responseBody: {},
    });
    expect(await store.get(tenantId, key, 'POST /v1/payments')).toBeNull();
  });

  it('overwrites existing records with the same composite key', async () => {
    await store.save(tenantId, key, route, {
      requestHash: 'first',
      responseStatus: 201,
      responseBody: { order: 1 },
    });
    await store.save(tenantId, key, route, {
      requestHash: 'second',
      responseStatus: 201,
      responseBody: { order: 2 },
    });

    const record = await store.get(tenantId, key, route);
    expect(record?.requestHash).toBe('second');
    expect(record?.responseBody).toEqual({ order: 2 });
  });

  it('evicts expired records and returns null', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T10:00:00Z'));

    await store.save(
      tenantId,
      key,
      route,
      { requestHash: 'x', responseStatus: 200, responseBody: {} },
      1, // 1 second TTL
    );

    expect(await store.get(tenantId, key, route)).not.toBeNull();
    vi.setSystemTime(new Date('2026-04-19T10:00:02Z')); // +2s
    expect(await store.get(tenantId, key, route)).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('uses default 24h TTL when none is specified', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T10:00:00Z'));

    await store.save(tenantId, key, route, {
      requestHash: 'x',
      responseStatus: 200,
      responseBody: {},
    });

    vi.setSystemTime(new Date('2026-04-20T09:59:59Z')); // +23h59m59s
    expect(await store.get(tenantId, key, route)).not.toBeNull();

    vi.setSystemTime(new Date('2026-04-20T10:00:01Z')); // +24h 1s
    expect(await store.get(tenantId, key, route)).toBeNull();
  });

  it('reset() clears all records', async () => {
    await store.save(tenantId, key, route, {
      requestHash: 'x',
      responseStatus: 200,
      responseBody: {},
    });
    store.reset();
    expect(store.size()).toBe(0);
    expect(await store.get(tenantId, key, route)).toBeNull();
  });
});
