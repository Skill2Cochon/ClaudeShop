import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  AuditLogRepository,
  TenantSettingsRepository,
} from '@claudeshop/core';
import {
  TenantSettingsPatchSchema,
  TenantSettingsSchema,
} from '@claudeshop/contracts/tenant-settings';
import { recordFromRequest } from '../audit/record.js';

export interface AdminSettingsRoutesDeps {
  settingsRepo: TenantSettingsRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerAdminSettingsRoutes(
  app: FastifyInstance,
  deps: AdminSettingsRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/settings',
    {
      schema: {
        response: { 200: z.object({ data: TenantSettingsSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const data = await deps.settingsRepo.get(tenantId);
      return { data };
    },
  );

  zApp.patch(
    '/v1/admin/settings',
    {
      schema: {
        body: TenantSettingsPatchSchema,
        response: { 200: z.object({ data: TenantSettingsSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const data = await deps.settingsRepo.update(tenantId, request.body);
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        action: 'tenant.settings.update',
        resourceType: 'tenant',
        resourceId: tenantId,
        diff: request.body as Record<string, unknown>,
      });
      return { data };
    },
  );
}
