import type {
  ModuleInstallation,
  ModuleInstallationRepository,
  ModuleStatus,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

/**
 * PrismaModuleInstallationRepository — persists per-tenant module install
 * records. Tenant-scoped writes honour RLS; the system-level
 * `listAllActive()` query runs without a tenant context so the
 * ModuleRegistry can materialise every tenant's modules at boot.
 *
 * Phase 3.2 will add:
 *   - envelope encryption on `settings` (DEK per tenant)
 *   - lifecycle hook orchestration (onInstall → onMigrate → onActivate)
 *   - capability enforcement per manifest.permissions
 */
export class PrismaModuleInstallationRepository
  implements ModuleInstallationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenant(tenantId: string): Promise<ModuleInstallation[]> {
    const rows = await this.prisma.moduleInstallation.findMany({
      where: { tenantId },
      orderBy: { installedAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async findByTenantAndModule(
    tenantId: string,
    moduleId: string,
  ): Promise<ModuleInstallation | null> {
    const row = await this.prisma.moduleInstallation.findUnique({
      where: { tenantId_moduleId: { tenantId, moduleId } },
    });
    return row ? toDomain(row) : null;
  }

  async install(input: {
    tenantId: string;
    moduleId: string;
    version: string;
    settings: Record<string, unknown>;
  }): Promise<ModuleInstallation> {
    const row = await this.prisma.moduleInstallation.upsert({
      where: {
        tenantId_moduleId: { tenantId: input.tenantId, moduleId: input.moduleId },
      },
      create: {
        tenantId: input.tenantId,
        moduleId: input.moduleId,
        version: input.version,
        settings: input.settings as object,
        status: 'INSTALLED',
      },
      update: {
        version: input.version,
        settings: input.settings as object,
        status: 'INSTALLED',
        lastError: null,
      },
    });
    return toDomain(row);
  }

  async updateStatus(
    tenantId: string,
    moduleId: string,
    status: ModuleStatus,
    lastError?: string | null,
  ): Promise<ModuleInstallation> {
    const existing = await this.findByTenantAndModule(tenantId, moduleId);
    if (!existing) {
      throw new NotFoundError(`ModuleInstallation not found: ${moduleId} / ${tenantId}`);
    }
    const row = await this.prisma.moduleInstallation.update({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      data: {
        status,
        lastError: lastError ?? null,
        ...(status === 'ACTIVE' ? { activatedAt: new Date() } : {}),
      },
    });
    return toDomain(row);
  }

  async updateSettings(
    tenantId: string,
    moduleId: string,
    settings: Record<string, unknown>,
  ): Promise<ModuleInstallation> {
    const existing = await this.findByTenantAndModule(tenantId, moduleId);
    if (!existing) {
      throw new NotFoundError(`ModuleInstallation not found: ${moduleId} / ${tenantId}`);
    }
    const row = await this.prisma.moduleInstallation.update({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      data: { settings: settings as object },
    });
    return toDomain(row);
  }

  async uninstall(tenantId: string, moduleId: string): Promise<void> {
    await this.prisma.moduleInstallation
      .delete({
        where: { tenantId_moduleId: { tenantId, moduleId } },
      })
      .catch(() => {
        // Idempotent — absent row is a success.
      });
  }

  async listAllActive(): Promise<ModuleInstallation[]> {
    const rows = await this.prisma.moduleInstallation.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { installedAt: 'desc' },
    });
    return rows.map(toDomain);
  }
}

type PrismaRow = NonNullable<
  Awaited<ReturnType<PrismaClient['moduleInstallation']['findUnique']>>
>;

function toDomain(row: PrismaRow): ModuleInstallation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    moduleId: row.moduleId,
    version: row.version,
    status: row.status,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    lastError: row.lastError,
    installedAt: row.installedAt.toISOString(),
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
