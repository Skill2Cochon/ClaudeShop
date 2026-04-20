import type { PrismaClient } from '@claudeshop/db';
import type { TenantSettingsRepository } from '@claudeshop/core';
import {
  DEFAULT_TENANT_SETTINGS,
  TenantSettingsSchema,
  mergeTenantSettings,
  type TenantSettings,
  type TenantSettingsPatch,
} from '@claudeshop/contracts/tenant-settings';
import { NotFoundError, ValidationError } from '@claudeshop/errors';

export class PrismaTenantSettingsRepository implements TenantSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(tenantId: string): Promise<TenantSettings> {
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!row) {
      throw new NotFoundError(`Tenant ${tenantId} not found`, {
        details: { tenantId },
      });
    }
    return coerce(row.settings);
  }

  async update(tenantId: string, patch: TenantSettingsPatch): Promise<TenantSettings> {
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!row) {
      throw new NotFoundError(`Tenant ${tenantId} not found`, {
        details: { tenantId },
      });
    }

    const current = coerce(row.settings);
    const next = mergeTenantSettings(current, patch);

    // Re-validate the full merged shape — protects against partial patches
    // that would leave required keys empty.
    const parsed = TenantSettingsSchema.safeParse(next);
    if (!parsed.success) {
      throw new ValidationError('Merged tenant settings are invalid', {
        details: parsed.error.issues,
      });
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: parsed.data as never },
    });
    return parsed.data;
  }
}

/**
 * Coerce whatever is currently on Tenant.settings into a valid
 * TenantSettings object. The column defaults to `{}` for new tenants so we
 * fall back to DEFAULT_TENANT_SETTINGS rather than throwing — the admin UI
 * can still render a usable form and persist a complete row.
 */
function coerce(raw: unknown): TenantSettings {
  if (raw && typeof raw === 'object') {
    const parsed = TenantSettingsSchema.safeParse({
      ...DEFAULT_TENANT_SETTINGS,
      ...(raw as Record<string, unknown>),
      brand: {
        ...DEFAULT_TENANT_SETTINGS.brand,
        ...((raw as { brand?: unknown }).brand as Record<string, unknown> | undefined),
      },
    });
    if (parsed.success) return parsed.data;
  }
  return DEFAULT_TENANT_SETTINGS;
}
