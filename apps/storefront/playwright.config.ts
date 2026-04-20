import { defineConfig, devices } from '@playwright/test';

/**
 * Storefront E2E — requires the full local stack running:
 *   pnpm docker:up
 *   pnpm db:migrate && pnpm db:seed
 *   pnpm --filter @claudeshop/api dev      (port 3001)
 *   pnpm --filter @claudeshop/storefront dev   (port 3000)
 *
 * Run locally:
 *   pnpm --filter @claudeshop/storefront test:e2e
 *
 * CI: the `test` job in .gitea/workflows/ci.yml spins up Postgres + Redis +
 * Meilisearch via services; the storefront + api are started before tests.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'dot' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.STOREFRONT_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add firefox / webkit when cross-browser matters (Phase 5).
  ],
});
