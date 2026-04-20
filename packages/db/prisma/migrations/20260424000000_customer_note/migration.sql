-- Phase 44 — CustomerNote
--
-- Merchant-facing CRM timeline. Same shape + semantics as OrderNote
-- (Phase 42) but keyed by customerId. Append-only; a correction is
-- a new note that references the prior one.

CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerNote_tenantId_customerId_createdAt_idx"
    ON "CustomerNote"("tenantId", "customerId", "createdAt" DESC);

CREATE INDEX "CustomerNote_tenantId_authorId_idx"
    ON "CustomerNote"("tenantId", "authorId");

-- Row-level security — same pattern as other tenant-scoped tables.
ALTER TABLE "CustomerNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerNote" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_customer_note"
    ON "CustomerNote"
    USING ("tenantId" = current_setting('app.tenant_id', true));
