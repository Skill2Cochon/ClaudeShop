-- Phase 33 — ApiKey per tenant
--
-- The raw key lives in the response payload exactly once (at creation);
-- every subsequent lookup is by prefix → bcrypt compare. `scopes` is a
-- text[] so the middleware can grow the ACL without a migration.

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");
CREATE UNIQUE INDEX "ApiKey_tenantId_name_key" ON "ApiKey"("tenantId", "name");
CREATE INDEX "ApiKey_tenantId_revokedAt_idx" ON "ApiKey"("tenantId", "revokedAt");
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- Row-level security — same pattern as other tenant-scoped tables.
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_api_key"
    ON "ApiKey"
    USING ("tenantId" = current_setting('app.tenant_id', true));
