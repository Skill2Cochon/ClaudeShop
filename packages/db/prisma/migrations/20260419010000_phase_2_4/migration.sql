-- Phase 2.4 — Idempotency + Payment models
-- Creates IdempotencyKey + Payment tables and PaymentStatus enum.
-- RLS policies added in the next migration block.

-- ============================================================
-- PaymentStatus enum
-- ============================================================
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

-- ============================================================
-- IdempotencyKey
-- ============================================================
CREATE TABLE "IdempotencyKey" (
  "id"             TEXT        NOT NULL,
  "tenantId"       TEXT        NOT NULL,
  "key"            TEXT        NOT NULL,
  "route"          TEXT        NOT NULL,
  "requestHash"    TEXT        NOT NULL,
  "responseStatus" INTEGER     NOT NULL,
  "responseBody"   JSONB       NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_tenantId_key_route_key"
  ON "IdempotencyKey" ("tenantId", "key", "route");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey" ("expiresAt");
CREATE INDEX "IdempotencyKey_tenantId_createdAt_idx"
  ON "IdempotencyKey" ("tenantId", "createdAt" DESC);

-- ============================================================
-- Payment
-- ============================================================
CREATE TABLE "Payment" (
  "id"             TEXT           NOT NULL,
  "tenantId"       TEXT           NOT NULL,
  "orderId"        TEXT           NOT NULL,
  "provider"       TEXT           NOT NULL,
  "providerRef"    TEXT           NOT NULL,
  "status"         "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount"         DECIMAL(12, 2) NOT NULL,
  "currency"       CHAR(3)        NOT NULL,
  "idempotencyKey" TEXT           NOT NULL,
  "capturedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_idempotencyKey_key"
  ON "Payment" ("idempotencyKey");
CREATE UNIQUE INDEX "Payment_tenantId_provider_providerRef_key"
  ON "Payment" ("tenantId", "provider", "providerRef");
CREATE INDEX "Payment_tenantId_orderId_idx" ON "Payment" ("tenantId", "orderId");
CREATE INDEX "Payment_tenantId_status_createdAt_idx"
  ON "Payment" ("tenantId", "status", "createdAt" DESC);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdempotencyKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_idempotency ON "IdempotencyKey"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment ON "Payment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Permissions for the runtime app role (claudeshop_app).
GRANT SELECT, INSERT, UPDATE, DELETE ON "IdempotencyKey" TO claudeshop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Payment"        TO claudeshop_app;
