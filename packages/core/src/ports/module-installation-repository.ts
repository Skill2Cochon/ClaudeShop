export type ModuleStatus = 'INSTALLED' | 'ACTIVE' | 'DISABLED' | 'FAILED';

export interface ModuleInstallation {
  id: string;
  tenantId: string;
  moduleId: string;
  version: string;
  status: ModuleStatus;
  settings: Record<string, unknown>;
  lastError: string | null;
  installedAt: string;
  activatedAt: string | null;
  updatedAt: string;
}

export interface ModuleInstallationRepository {
  findByTenant(tenantId: string): Promise<ModuleInstallation[]>;
  findByTenantAndModule(
    tenantId: string,
    moduleId: string,
  ): Promise<ModuleInstallation | null>;

  /**
   * Upsert on (tenantId, moduleId). Install with status INSTALLED; caller
   * transitions to ACTIVE after onActivate succeeds.
   */
  install(input: {
    tenantId: string;
    moduleId: string;
    version: string;
    settings: Record<string, unknown>;
  }): Promise<ModuleInstallation>;

  updateStatus(
    tenantId: string,
    moduleId: string,
    status: ModuleStatus,
    lastError?: string | null,
  ): Promise<ModuleInstallation>;

  updateSettings(
    tenantId: string,
    moduleId: string,
    settings: Record<string, unknown>,
  ): Promise<ModuleInstallation>;

  uninstall(tenantId: string, moduleId: string): Promise<void>;

  /**
   * Global sweep — lists every ACTIVE installation across all tenants.
   * Used at boot by the ModuleRegistry to materialise per-tenant caches.
   * Implementations MUST bypass RLS (this is a system call with admin
   * privileges, not a request-scoped query).
   */
  listAllActive(): Promise<ModuleInstallation[]>;
}
