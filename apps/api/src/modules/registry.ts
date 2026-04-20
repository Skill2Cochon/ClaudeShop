import type {
  ModuleInstallation,
  ModuleInstallationRepository,
  PaymentProvider,
} from '@claudeshop/core';
import type { FastifyBaseLogger } from 'fastify';
import { StubPaymentProvider } from '../adapters/stub-payment-provider.js';

/** Known module ids registered at build-time. Phase 3.2 dynamic discovery. */
export const KNOWN_MODULES = {
  'stripe-payments': '@claudeshop/payment-stripe',
} as const;

/**
 * Factory signature every module must export (Phase 3.1 — simplified).
 * The ModuleRegistry invokes this at activation time with the validated
 * settings from ModuleInstallation.
 */
export interface PaymentProviderFactory {
  createProvider(settings: Record<string, unknown>): PaymentProvider;
}

export interface ModuleRegistryOptions {
  installationRepo: ModuleInstallationRepository;
  /** Fallback when no tenant has an active PaymentProvider module. */
  fallbackPaymentProvider: PaymentProvider;
  logger: FastifyBaseLogger;
}

/**
 * Per-tenant provider registry, rebuilt at boot from ACTIVE
 * ModuleInstallation rows. Runtime mutations (install/uninstall/configure)
 * invalidate + rebuild the tenant's cached provider entry.
 *
 * Phase 3.1 scope:
 * - PaymentProvider resolution only (shipping, analytics, AI added Phase 3.2)
 * - Dynamic ESM import per module id
 * - Settings stored in DB (envelope-encrypted at application layer Phase 3.2)
 * - Graceful fallback to StubPaymentProvider if no module is active
 */
export class ModuleRegistry {
  private readonly paymentProviderCache = new Map<string, PaymentProvider>();
  private initialised = false;

  constructor(private readonly opts: ModuleRegistryOptions) {}

  /** Load every ACTIVE installation across tenants at boot. */
  async init(): Promise<void> {
    const active = await this.opts.installationRepo.listAllActive();
    this.opts.logger.info({ count: active.length }, 'Module registry — loading active installations');

    for (const install of active) {
      try {
        await this.materialise(install);
      } catch (err) {
        this.opts.logger.error(
          { err, moduleId: install.moduleId, tenantId: install.tenantId },
          'Module failed to materialise at boot — skipping',
        );
      }
    }
    this.initialised = true;
  }

  /**
   * Returns the PaymentProvider configured for the tenant, or the fallback
   * when no module is active. In test / dev this typically yields the stub.
   */
  getPaymentProvider(tenantId: string): PaymentProvider {
    return this.paymentProviderCache.get(tenantId) ?? this.opts.fallbackPaymentProvider;
  }

  /**
   * Install (or reinstall) a module for a tenant with new settings. Performs
   * an immediate activation attempt — on success the provider is registered
   * live; on failure status=FAILED is persisted with lastError.
   */
  async installAndActivate(
    tenantId: string,
    moduleId: string,
    version: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    await this.opts.installationRepo.install({ tenantId, moduleId, version, settings });
    try {
      await this.activate(tenantId, moduleId, settings);
      await this.opts.installationRepo.updateStatus(tenantId, moduleId, 'ACTIVE');
      this.opts.logger.info({ tenantId, moduleId }, 'Module activated');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.opts.installationRepo.updateStatus(tenantId, moduleId, 'FAILED', message);
      this.opts.logger.error({ err, tenantId, moduleId }, 'Module activation failed');
      throw err;
    }
  }

  async disable(tenantId: string, moduleId: string): Promise<void> {
    this.paymentProviderCache.delete(tenantId);
    await this.opts.installationRepo.updateStatus(tenantId, moduleId, 'DISABLED');
  }

  async uninstall(tenantId: string, moduleId: string): Promise<void> {
    this.paymentProviderCache.delete(tenantId);
    await this.opts.installationRepo.uninstall(tenantId, moduleId);
  }

  /** List installations visible to a tenant (DB truth). */
  async list(tenantId: string): Promise<ModuleInstallation[]> {
    return this.opts.installationRepo.findByTenant(tenantId);
  }

  get isReady(): boolean {
    return this.initialised;
  }

  // --- private --------------------------------------------------------------

  private async materialise(install: ModuleInstallation): Promise<void> {
    await this.activate(install.tenantId, install.moduleId, install.settings);
  }

  private async activate(
    tenantId: string,
    moduleId: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    switch (moduleId) {
      case '@claudeshop/payment-stripe': {
        const mod = await import('@claudeshop/module-payment-stripe');
        const provider = mod.createStripeProvider(
          settings as Parameters<typeof mod.createStripeProvider>[0],
        );
        this.paymentProviderCache.set(tenantId, provider);
        return;
      }
      default:
        throw new Error(`Unknown moduleId: ${moduleId}`);
    }
  }
}

/**
 * Convenience: returns a wrapping PaymentProvider that resolves per-request
 * against the registry using a provided resolveTenantId function. Useful
 * for apps/api which needs a single PaymentProvider instance but must
 * route calls per-tenant.
 */
export function createTenantScopedPaymentProvider(
  registry: ModuleRegistry,
  fallback: PaymentProvider,
): PaymentProvider & { resolve(tenantId: string): PaymentProvider } {
  const wrapper: PaymentProvider & { resolve(tenantId: string): PaymentProvider } = {
    name: 'tenant-scoped',
    resolve(tenantId: string): PaymentProvider {
      return registry.getPaymentProvider(tenantId);
    },
    createIntent(input, idempotencyKey) {
      const provider = registry.getPaymentProvider(input.tenantId) ?? fallback;
      return provider.createIntent(input, idempotencyKey);
    },
    refund(input, idempotencyKey) {
      // Without tenantId in RefundInput we fall back to the default. Phase
      // 3.2 will extend RefundInput with tenantId for per-tenant routing.
      return fallback.refund(input, idempotencyKey);
    },
    verifyWebhook(payload, signature) {
      return fallback.verifyWebhook(payload, signature);
    },
  };
  return wrapper;
}
