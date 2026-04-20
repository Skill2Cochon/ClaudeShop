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
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
