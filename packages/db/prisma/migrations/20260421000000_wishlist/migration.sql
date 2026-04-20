-- Phase 27 — WishlistItem
--
-- Simple append/remove per (tenant, customer, product). No qty, no priority —
-- Phase 27.1 may add notes / sort keys once the UX need is real.

CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WishlistItem_tenantId_customerId_productId_key"
    ON "WishlistItem"("tenantId", "customerId", "productId");

CREATE INDEX "WishlistItem_tenantId_customerId_createdAt_idx"
    ON "WishlistItem"("tenantId", "customerId", "createdAt" DESC);

CREATE INDEX "WishlistItem_tenantId_productId_idx"
    ON "WishlistItem"("tenantId", "productId");

-- Row-level security — same pattern as other tenant-scoped tables
ALTER TABLE "WishlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WishlistItem" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_wishlist_item"
    ON "WishlistItem"
    USING ("tenantId" = current_setting('app.tenant_id', true));
