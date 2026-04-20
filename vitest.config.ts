import { defineConfig } from 'vitest/config';

/**
 * Root vitest config — each package inherits via `extends` or uses it directly
 * when running `vitest` without its own config.
 *
 * `passWithNoTests: true` lets CI run `pnpm -r test` without failing on packages
 * that don't have tests yet. Failures for packages with tests still bubble up.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', 'generated'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.d.ts'],
    },
  },
});
