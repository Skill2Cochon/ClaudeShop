import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@claudeshop/ui', '@claudeshop/contracts', '@claudeshop/sdk'],
  // `standalone` output + monorepo trace root — see apps/admin/next.config.ts
  // for the rationale. Production Docker image uses the generated
  // `.next/standalone` folder as the entrypoint.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  experimental: {
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.claudeshop.dev' },
      { protocol: 'https', hostname: '**.claudeshop.io' },
    ],
  },
};

export default nextConfig;
