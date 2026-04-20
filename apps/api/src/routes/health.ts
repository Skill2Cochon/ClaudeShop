import type { FastifyInstance } from 'fastify';

/**
 * /healthz  — liveness probe (always 200 if the process is running).
 * /readyz   — readiness probe (checks downstream dependencies).
 * /health   — alias for /healthz, exposed because every second-hand
 *             tutorial + our own handbook/Dockerfile healthcheck probe
 *             that path by instinct. Keeping both avoids silent 404s.
 *
 * Coolify / k8s use /healthz; Uptime Kuma uses /readyz.
 * Neither endpoint is subject to rate limiting (allow-list in plugin).
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  const startedAt = Date.now();

  const livenessHandler = async () => ({
    data: {
      status: 'ok' as const,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    },
  });

  app.get('/healthz', { config: { rateLimit: false } }, livenessHandler);
  app.get('/health', { config: { rateLimit: false } }, livenessHandler);

  app.get('/readyz', {
    config: { rateLimit: false },
  }, async () => {
    // Phase 1: always ready once boot completes.
    // Phase 2 wires real checks: prisma.$queryRaw(SELECT 1), redis.ping(), meilisearch.health(), outbox_lag_seconds < 60.
    const checks = {
      postgres: true,
      redis: true,
      meilisearch: true,
      outbox: true,
    };
    const allOk = Object.values(checks).every(Boolean);
    return {
      data: {
        status: allOk ? ('ready' as const) : ('unhealthy' as const),
        checks,
      },
    };
  });
}
