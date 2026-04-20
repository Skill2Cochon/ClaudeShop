-- Phase 5 — Admin session auth
--
-- AuthUser = identity layer per tenant. Merchant staff + admins + registered
-- customers all live here differentiated by `role`. Phase 5.1 adds
-- B2B roles (Manager, Approver) + API keys in a sibling table.

CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CUSTOMER');

CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "displayName" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthUser_tenantId_email_key" ON "AuthUser"("tenantId", "email");
CREATE INDEX "AuthUser_tenantId_role_idx" ON "AuthUser"("tenantId", "role");
CREATE INDEX "AuthUser_email_idx" ON "AuthUser"("email");

-- Row-Level Security — same pattern as other tenant-scoped tables.
ALTER TABLE "AuthUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthUser" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_auth_user"
    ON "AuthUser"
    USING ("tenantId" = current_setting('app.tenant_id', true));
