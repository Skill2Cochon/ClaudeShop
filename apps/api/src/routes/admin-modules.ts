import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ModuleRegistry } from '../modules/registry.js';
import type {
  AuditLogRepository,
  ModuleInstallationRepository,
} from '@claudeshop/core';
import { recordFromRequest } from '../audit/record.js';

export interface AdminModuleRoutesDeps {
  registry: ModuleRegistry;
  installationRepo: ModuleInstallationRepository;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Admin surface for module installation + configuration. Phase 3.1 v0.1.
 *
 * - GET    /v1/admin/modules            → list installed modules for tenant
 * - POST   /v1/admin/modules/:id/install → install + activate with settings
 * - POST   /v1/admin/modules/:id/disable → mark DISABLED (keeps row)
 * - DELETE /v1/admin/modules/:id        → remove installation row
 *
 * Phase 3.2 adds auth middleware that requires the `modules:admin` scope.
 */
export async function registerAdminModuleRoutes(
  app: FastifyInstance,
  deps: AdminModuleRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const ModuleInstallationSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    moduleId: z.string(),
    version: z.string(),
    status: z.enum(['INSTALLED', 'ACTIVE', 'DISABLED', 'FAILED']),
    settings: z.record(z.unknown()),
    lastError: z.string().nullable(),
    installedAt: z.string(),
    activatedAt: z.string().nullable(),
    updatedAt: z.string(),
  });

  // --- GET /v1/admin/modules -----------------------------------------------
  zApp.get('/v1/admin/modules', {
    schema: {
      response: {
        200: z.object({ data: z.array(ModuleInstallationSchema) }),
      },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const installations = await deps.installationRepo.findByTenant(tenantId);
    return { data: installations };
  });

  // --- POST /v1/admin/modules/:id/install ----------------------------------
  const InstallBodySchema = z.object({
    version: z.string().default('0.1.0'),
    settings: z.record(z.unknown()).default({}),
  });

  zApp.post('/v1/admin/modules/:id/install', {
    schema: {
      params: z.object({ id: z.string() }),
      body: InstallBodySchema,
      response: {
        201: z.object({ data: ModuleInstallationSchema }),
      },
    },
  }, async (request, reply) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    await deps.registry.installAndActivate(
      tenantId,
      request.params.id,
      request.body.version,
      request.body.settings,
    );
    const installation = await deps.installationRepo.findByTenantAndModule(
      tenantId,
      request.params.id,
    );
    if (!installation) {
      throw new Error('Module install race — installation missing after activation');
    }
    await recordFromRequest(deps.auditLogRepo, request, tenantId, {
      actorType: 'user',
      action: 'module.install',
      resourceType: 'module_installation',
      resourceId: request.params.id,
      diff: { version: request.body.version },
    });
    return reply.status(201).send({ data: installation });
  });

  // --- POST /v1/admin/modules/:id/disable ----------------------------------
  zApp.post('/v1/admin/modules/:id/disable', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ data: z.object({ disabled: z.boolean() }) }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    await deps.registry.disable(tenantId, request.params.id);
    await recordFromRequest(deps.auditLogRepo, request, tenantId, {
      actorType: 'user',
      action: 'module.disable',
      resourceType: 'module_installation',
      resourceId: request.params.id,
    });
    return { data: { disabled: true } };
  });

  // --- DELETE /v1/admin/modules/:id ----------------------------------------
  zApp.delete('/v1/admin/modules/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ data: z.object({ uninstalled: z.boolean() }) }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    await deps.registry.uninstall(tenantId, request.params.id);
    await recordFromRequest(deps.auditLogRepo, request, tenantId, {
      actorType: 'user',
      action: 'module.uninstall',
      resourceType: 'module_installation',
      resourceId: request.params.id,
    });
    return { data: { uninstalled: true } };
  });
}
