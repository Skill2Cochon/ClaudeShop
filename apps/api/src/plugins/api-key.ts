import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  verifyApiKey,
  type ApiKeyRepository,
  type ApiKeyVerified,
  type PasswordHasher,
} from '@claudeshop/core';

export interface ApiKeyPluginOptions {
  repo: ApiKeyRepository;
  hasher: PasswordHasher;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by apiKeyPlugin when a valid x-api-key header is present. */
    apiKey?: ApiKeyVerified;
  }
}

/**
 * Resolves the incoming `x-api-key` header (or `authorization: Bearer …`)
 * into an ApiKeyVerified and attaches it to `request.apiKey`. This plugin
 * is intentionally permissive — it does NOT reject requests without an
 * API key. Upstream code reads `request.apiKey` when present, and also
 * uses it as a fallback tenant resolver so API-key-only clients don't
 * need to send `x-tenant-id`.
 */
export const apiKeyPlugin = fp(async function apiKeyPlugin(
  app: FastifyInstance,
  opts: ApiKeyPluginOptions,
) {
  app.addHook('preHandler', async (request: FastifyRequest) => {
    const raw = readApiKey(request);
    if (!raw) return;

    const verified = await verifyApiKey(raw, {
      repo: opts.repo,
      hasher: opts.hasher,
    });
    if (verified) {
      request.apiKey = verified;
      // Promote tenantId into x-tenant-id so the existing resolveTenantId
      // path works unchanged. The plugin never overrides an explicit header
      // — when both are present and disagree, the explicit header wins
      // (caller intent is clearer than API-key membership).
      const headers = request.headers as Record<string, string | string[] | undefined>;
      if (typeof headers['x-tenant-id'] !== 'string') {
        headers['x-tenant-id'] = verified.tenantId;
      }
    }
  });
});

function readApiKey(request: FastifyRequest): string | null {
  const headers = request.headers as Record<string, string | string[] | undefined>;
  const direct = headers['x-api-key'];
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const authorization = headers['authorization'];
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token.length > 0) return token;
  }
  return null;
}
