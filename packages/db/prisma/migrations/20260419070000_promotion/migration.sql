-- Phase 7 — Promotions (discount codes)

CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'EXPIRED');

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" CHAR(3),
    "minSubtotalCents" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Promotion_tenantId_code_key" ON "Promotion"("tenantId", "code");
CREATE INDEX "Promotion_tenantId_status_endsAt_idx" ON "Promotion"("tenantId", "status", "endsAt");

ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_promotion"
    ON "Promotion"
    USING ("tenantId" = current_setting('app.tenant_id', true));
