-- Phase 3.1 — Per-tenant module installation registry

CREATE TYPE "ModuleStatus" AS ENUM (
  'INSTALLED',
  'ACTIVE',
  'DISABLED',
  'FAILED'
);

CREATE TABLE "ModuleInstallation" (
  "id"          TEXT           NOT NULL,
  "tenantId"    TEXT           NOT NULL,
  "moduleId"    TEXT           NOT NULL,
  "version"     TEXT           NOT NULL,
  "status"      "ModuleStatus" NOT NULL DEFAULT 'INSTALLED',
  "settings"    JSONB          NOT NULL DEFAULT '{}'::jsonb,
  "lastError"   TEXT,
  "installedAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "updatedAt"   TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "ModuleInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleInstallation_tenantId_moduleId_key"
  ON "ModuleInstallation" ("tenantId", "moduleId");
CREATE INDEX "ModuleInstallation_tenantId_status_idx"
  ON "ModuleInstallation" ("tenantId", "status");
CREATE INDEX "ModuleInstallation_moduleId_status_idx"
  ON "ModuleInstallation" ("moduleId", "status");

ALTER TABLE "ModuleInstallation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModuleInstallation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_module_installation ON "ModuleInstallation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "ModuleInstallation" TO claudeshop_app;
