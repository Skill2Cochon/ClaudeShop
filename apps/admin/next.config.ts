import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@claudeshop/ui',
    '@claudeshop/contracts',
    '@claudeshop/sdk',
    '@claudeshop/core',
    '@claudeshop/errors',
  ],
  // `standalone` output bundles the minimal runtime + pruned node_modules so
  // the production Docker image stays under ~200 MB. `outputFileTracingRoot`
  // must point at the monorepo root so Next follows pnpm symlinks into
  // `packages/*` and `modules/*`. Keep these two lines in sync with the
  // storefront's next.config.ts.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  // Phase 60 fix — Turbopack needs the extension alias to resolve the
  // TS-style `.js` imports inside transpiled packages (e.g. contracts'
  // internal `import { CuidSchema } from '../common/primitives.js'`
  // where the file on disk is primitives.ts). Without this, a fresh
  // install with empty dist/ 500s with "Module not found" on every
  // package import. The alias tells Turbopack "when asked for .js,
  // try .ts first, then .tsx, then .jsx, then the literal .js".
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
