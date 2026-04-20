-- Phase 11 — CRM lite: customer segments + email campaigns

CREATE TABLE "CustomerSegment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "refreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSegment_tenantId_name_key"
    ON "CustomerSegment"("tenantId", "name");
CREATE INDEX "CustomerSegment_tenantId_idx" ON "CustomerSegment"("tenantId");

ALTER TABLE "CustomerSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerSegment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customer_segment"
    ON "CustomerSegment"
    USING ("tenantId" = current_setting('app.tenant_id', true));


CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "segmentId" TEXT,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailCampaign_tenantId_status_scheduledAt_idx"
    ON "EmailCampaign"("tenantId", "status", "scheduledAt");
CREATE INDEX "EmailCampaign_tenantId_sentAt_idx"
    ON "EmailCampaign"("tenantId", "sentAt" DESC);

ALTER TABLE "EmailCampaign"
    ADD CONSTRAINT "EmailCampaign_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailCampaign" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_email_campaign"
    ON "EmailCampaign"
    USING ("tenantId" = current_setting('app.tenant_id', true));
