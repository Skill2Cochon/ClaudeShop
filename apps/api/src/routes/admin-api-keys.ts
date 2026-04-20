import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  mintApiKey,
  type ApiKeyRepository,
  type AuditLogRepository,
  type PasswordHasher,
} from '@claudeshop/core';
import { recordFromRequest } from '../audit/record';

export interface AdminApiKeyRoutesDeps {
  apiKeyRepo: ApiKeyRepository;
  hasher: PasswordHasher;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

const RowSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export async function registerAdminApiKeyRoutes(
  app: FastifyInstance,
  deps: AdminApiKeyRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/api-keys',
    {
      schema: { response: { 200: z.object({ data: z.array(RowSchema) }) } },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const rows = await deps.apiKeyRepo.list(tenantId);
      return { data: rows };
    },
  );

  zApp.post(
    '/v1/admin/api-keys',
    {
      schema: {
        body: z.object({
          name: z.string().min(1).max(80),
          scopes: z.array(z.string().min(1).max(64)).max(32).optional(),
        }),
        response: {
          201: z.object({
            data: z.object({
              row: RowSchema,
              /** The raw secret — shown exactly once. */
              rawKey: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const result = await mintApiKey(request.body, {
        tenantId,
        repo: deps.apiKeyRepo,
        hasher: deps.hasher,
      });
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'api_key.mint',
        resourceType: 'api_key',
        resourceId: result.row.id,
        diff: {
          name: result.row.name,
          prefix: result.row.prefix,
          scopes: result.row.scopes,
        },
      });
      return reply
        .status(201)
        .send({ data: { row: result.row, rawKey: result.rawKey } });
    },
  );

  zApp.post(
    '/v1/admin/api-keys/:id/revoke',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: z.object({ data: z.object({ revoked: z.boolean() }) }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.apiKeyRepo.revoke(tenantId, request.params.id);
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'api_key.revoke',
        resourceType: 'api_key',
        resourceId: request.params.id,
      });
      return { data: { revoked: true } };
    },
  );
}
