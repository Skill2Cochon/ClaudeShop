-- Phase 50 — CustomerAddress
--
-- Saved shipping addresses for registered customers. Field set is
-- the same as the Phase 35 guest-checkout ShippingAddress so the
-- checkout form can prefill with a single row lookup and zero
-- shape conversion. isDefault marks the "first" address — at most
-- one per customer, enforced at the application layer.

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAddress_tenantId_customerId_createdAt_idx"
    ON "CustomerAddress"("tenantId", "customerId", "createdAt" DESC);

CREATE INDEX "CustomerAddress_tenantId_customerId_isDefault_idx"
    ON "CustomerAddress"("tenantId", "customerId", "isDefault");

-- Row-level security — same pattern as other tenant-scoped tables.
ALTER TABLE "CustomerAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerAddress" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_customer_address"
    ON "CustomerAddress"
    USING ("tenantId" = current_setting('app.tenant_id', true));
