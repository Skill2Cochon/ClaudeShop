import { test, expect } from '@playwright/test';

/**
 * Golden path — the flow every webshop MUST work:
 *
 *   1. Load the home page
 *   2. Navigate to the seeded PDP
 *   3. Add a variant to cart
 *   4. Review cart + confirm quantities
 *   5. Place order (no payment in Phase 2)
 *   6. Land on "order confirmed" page with a real order number
 *
 * Seed requirement (packages/db/src/seed.ts):
 *   - Tenant slug: "demo"
 *   - Product slug: "hello-claudeshop-tee"
 *   - 3 variants (HCS-TEE-S / -M / -L)
 *   - At least one price set in EUR + inventory > 0 (added via seed Phase 2.3+)
 */

test.describe('Storefront golden path (EN)', () => {
  test('home → PDP → add to cart → checkout → order confirmed', async ({ page }) => {
    // 1. Home page
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /modern commerce CMS/i })).toBeVisible();

    // 2. PDP
    await page.goto('/en/p/hello-claudeshop-tee');
    await expect(page.getByRole('heading', { name: /Hello ClaudeShop Tee/i })).toBeVisible();
    await expect(page.locator('text=HCS-TEE-S').first()).toBeVisible();

    // 3. Add the first variant to cart
    const addButtons = page.getByRole('button', { name: /^Add to cart$/i });
    await addButtons.first().click();

    // 4. Cart page — item is listed
    await page.goto('/en/cart');
    await expect(page.getByRole('heading', { name: /Review your cart/i })).toBeVisible();
    await expect(page.getByText(/Subtotal/i)).toBeVisible();

    // 5. Place order (no email, Phase 2 allows anonymous)
    await page.getByRole('button', { name: /Place order/i }).click();

    // 6. Order confirmed page
    await expect(page.getByRole('heading', { name: /your order is in/i })).toBeVisible();
    await expect(page.getByText(/Order /i)).toBeVisible();
    await expect(page.getByText(/PENDING_PAYMENT/)).toBeVisible();
  });

  test('cart shows empty state when no cookie', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/en/cart');
    await expect(page.getByRole('heading', { name: /Your cart is empty/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse products/i })).toBeVisible();
  });

  test('PDP 404s for an unknown slug', async ({ page }) => {
    const response = await page.goto('/en/p/this-product-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Health endpoints', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  test('GET /healthz returns 200 with status: ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/healthz`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { status: string; uptime: number } };
    expect(body.data.status).toBe('ok');
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  test('GET /readyz returns 200 with all checks true', async ({ request }) => {
    const res = await request.get(`${API_URL}/readyz`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { status: string; checks: Record<string, boolean> } };
    expect(body.data.status).toBe('ready');
  });
});
