import { test, expect } from '@playwright/test';

/**
 * Idempotency-Key tests — hit the API directly (no UI involvement).
 * Requires a seeded cart with at least one item. The test creates a fresh
 * cart per-run to stay isolated.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = process.env.STOREFRONT_TENANT_ID ?? 'demo';

test.describe('POST /v1/orders idempotency', () => {
  test.skip(
    !process.env.RUN_IDEMPOTENCY_E2E,
    'Skipped unless RUN_IDEMPOTENCY_E2E=1 — requires seeded cart fixtures (Phase 2.4).',
  );

  test('same Idempotency-Key + same payload → replays cached response', async ({ request }) => {
    // Arrange: Phase 2.4 will seed a cart via API fixture helpers.
    const cartId = process.env.TEST_CART_ID ?? '';
    const key = `itest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const first = await request.post(`${API_URL}/v1/orders`, {
      headers: {
        'x-tenant-id': TENANT_ID,
        'idempotency-key': key,
      },
      data: { cartId },
    });
    expect(first.status()).toBe(201);
    const firstBody = (await first.json()) as { data: { id: string; number: string } };

    const second = await request.post(`${API_URL}/v1/orders`, {
      headers: {
        'x-tenant-id': TENANT_ID,
        'idempotency-key': key,
      },
      data: { cartId },
    });
    expect(second.status()).toBe(201);
    expect(second.headers()['x-idempotency-replay']).toBe('true');
    const secondBody = (await second.json()) as { data: { id: string; number: string } };
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });

  test('same Idempotency-Key + different payload → 409 IDEMPOTENCY_CONFLICT', async ({
    request,
  }) => {
    const cartA = process.env.TEST_CART_ID_A ?? '';
    const cartB = process.env.TEST_CART_ID_B ?? '';
    const key = `itest-conflict-${Date.now()}`;

    const first = await request.post(`${API_URL}/v1/orders`, {
      headers: { 'x-tenant-id': TENANT_ID, 'idempotency-key': key },
      data: { cartId: cartA },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`${API_URL}/v1/orders`, {
      headers: { 'x-tenant-id': TENANT_ID, 'idempotency-key': key },
      data: { cartId: cartB },
    });
    expect(second.status()).toBe(409);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
