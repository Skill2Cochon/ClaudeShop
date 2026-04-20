import type {
  TenantSettings,
  TenantSettingsPatch,
} from '@claudeshop/contracts/tenant-settings';

/**
 * Read + patch the per-tenant settings blob (Tenant.settings Json column).
 *
 * Implementations MUST:
 *   - return DEFAULT_TENANT_SETTINGS-like values when the column is {} or
 *     partial, so the admin UI never renders an empty form
 *   - merge+revalidate on write (never blindly overwrite); see
 *     mergeTenantSettings() in the contracts package
 */
export interface TenantSettingsRepository {
  get(tenantId: string): Promise<TenantSettings>;
  update(tenantId: string, patch: TenantSettingsPatch): Promise<TenantSettings>;
}
