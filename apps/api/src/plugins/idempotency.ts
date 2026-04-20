import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { IdempotencyStore } from '@claudeshop/core';
import { IdempotencyConflictError } from '@claudeshop/errors';

export interface IdempotencyPluginOptions {
  store: IdempotencyStore;
  /**
   * Route signatures ("METHOD /path") that require Idempotency-Key. Plugin
   * is a no-op for any other route. Example: ["POST /v1/orders"].
   */
  routes: ReadonlySet<string>;
  /** Resolve tenantId from the request (same function as app-level). */
  resolveTenantId: (req: FastifyRequest) => string;
  /** Override TTL in seconds. Default: 24h. */
  ttlSeconds?: number;
  /** Minimum Idempotency-Key length (default 8 — UUIDs, ULIDs, nanoids pass). */
  minKeyLength?: number;
}

/** Metadata the plugin attaches for the handler lifecycle. */
interface IdempotencyContext {
  tenantId: string;
  key: string;
  route: string;
  requestHash: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotency?: IdempotencyContext;
  }
}

/**
 * Fastify plugin implementing Idempotency-Key semantics (RFC-draft):
 *
 * - Only activates for method+URL signatures listed in `routes`.
 * - Header `Idempotency-Key` is OPTIONAL (Phase 2.3). When present, responses
 *   are cached for ttlSeconds and replayed on retry with the same payload hash.
 * - Same key with a different payload hash → 409 IDEMPOTENCY_CONFLICT.
 * - No header → normal behaviour (no cache).
 *
 * Phase 2.4 upgrade: swap InMemoryIdempotencyStore for Redis / Postgres.
 */
async function plugin(
  app: FastifyInstance,
  opts: IdempotencyPluginOptions,
): Promise<void> {
  const minKeyLength = opts.minKeyLength ?? 8;

  app.addHook(
    'preHandler',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (req.method === 'GET' || req.method === 'HEAD') return;

      const routeUrl = req.routeOptions.url ?? req.url;
      const routeKey = `${req.method} ${routeUrl}`;
      if (!opts.routes.has(routeKey)) return;

      const raw = req.headers['idempotency-key'];
      const key = typeof raw === 'string' ? raw.trim() : undefined;
      if (!key || key.length < minKeyLength) return;

      const tenantId = opts.resolveTenantId(req);
      const requestHash = hashBody(req.body);

      const existing = await opts.store.get(tenantId, key, routeKey);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new IdempotencyConflictError(
            'Idempotency-Key reused with a different request payload',
            { details: { key, route: routeKey } },
          );
        }
        // Replay cached response.
        reply
          .status(existing.responseStatus)
          .header('x-idempotency-replay', 'true')
          .type('application/json');
        await reply.send(existing.responseBody);
        return;
      }

      req.idempotency = { tenantId, key, route: routeKey, requestHash };
    },
  );

  app.addHook(
    'onSend',
    async (
      req: FastifyRequest,
      reply: FastifyReply,
      payload: unknown,
    ): Promise<unknown> => {
      const ctx = req.idempotency;
      if (!ctx) return payload;
      if (reply.statusCode >= 500) return payload; // never cache server errors

      try {
        const body =
          typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload;
        await opts.store.save(
          ctx.tenantId,
          ctx.key,
          ctx.route,
          {
            requestHash: ctx.requestHash,
            responseStatus: reply.statusCode,
            responseBody: body,
          },
          opts.ttlSeconds,
        );
      } catch (err) {
        req.log.warn(
          { err, idempotency: { key: ctx.key } },
          'Failed to cache idempotent response',
        );
      }
      return payload;
    },
  );
}

export const idempotencyPlugin = fp(plugin, {
  name: 'claudeshop-idempotency',
  fastify: '5.x',
});

function hashBody(body: unknown): string {
  const normalized =
    typeof body === 'string'
      ? body
      : body === undefined || body === null
        ? ''
        : JSON.stringify(body);
  return createHash('sha256').update(normalized).digest('hex');
}
