import type { Logger } from '@claudeshop/telemetry';
import type { EventBus } from '@claudeshop/events';
import type { ModuleManifest } from './manifest.js';

/**
 * Context objects passed to each lifecycle hook.
 * Only capabilities granted by the manifest's `permissions` are exposed.
 */
export interface InstallCtx {
  readonly manifest: ModuleManifest;
  readonly tenantId: string;
  readonly logger: Logger;
  readonly events: EventBus;
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface MigrateCtx extends InstallCtx {
  readonly schemaName: string; // "module_<id>"
  sql(raw: string, params?: unknown[]): Promise<void>;
}

export interface ActivateCtx extends InstallCtx {
  /** Register HTTP routes, GraphQL resolvers, event subscribers, etc. */
  readonly registry: {
    routes?: unknown;
    graphql?: unknown;
    jobs?: unknown;
  };
}

/**
 * Optional lifecycle callbacks exported by a module.
 * All hooks are optional; the runtime skips missing ones.
 */
export interface ModuleLifecycle {
  onInstall?(ctx: InstallCtx): Promise<void>;
  onMigrate?(ctx: MigrateCtx): Promise<void>;
  onActivate?(ctx: ActivateCtx): Promise<void>;
  onDeactivate?(ctx: ActivateCtx): Promise<void>;
  onUninstall?(ctx: InstallCtx): Promise<void>;
  onUpgrade?(fromVersion: string, toVersion: string, ctx: InstallCtx): Promise<void>;
}
