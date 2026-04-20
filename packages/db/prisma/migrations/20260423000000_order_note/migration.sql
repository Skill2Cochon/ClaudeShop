-- Phase 42 — OrderNote
--
-- Merchant-facing internal timeline for orders. Append-only: a "fix"
-- is a new note that references the prior one, not a silent rewrite.
-- authorType ∈ {'user','system'}; system notes (webhook redelivery,
-- refund-issued, carrier scan) are written by the API itself.

CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderNote_tenantId_orderId_createdAt_idx"
    ON "OrderNote"("tenantId", "orderId", "createdAt" DESC);

CREATE INDEX "OrderNote_tenantId_authorId_idx"
    ON "OrderNote"("tenantId", "authorId");

-- Row-level security — same pattern as other tenant-scoped tables.
ALTER TABLE "OrderNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderNote" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_order_note"
    ON "OrderNote"
    USING ("tenantId" = current_setting('app.tenant_id', true));
