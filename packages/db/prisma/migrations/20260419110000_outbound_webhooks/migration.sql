-- Phase 14 — Outbound webhooks (subscriptions + delivery log)

CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookSubscription_tenantId_isActive_idx"
    ON "WebhookSubscription"("tenantId", "isActive");

ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_webhook_subscription"
    ON "WebhookSubscription"
    USING ("tenantId" = current_setting('app.tenant_id', true));


CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookDelivery_subscriptionId_eventId_key"
    ON "WebhookDelivery"("subscriptionId", "eventId");
CREATE INDEX "WebhookDelivery_tenantId_status_createdAt_idx"
    ON "WebhookDelivery"("tenantId", "status", "createdAt" DESC);
CREATE INDEX "WebhookDelivery_tenantId_eventType_createdAt_idx"
    ON "WebhookDelivery"("tenantId", "eventType", "createdAt" DESC);

ALTER TABLE "WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_webhook_delivery"
    ON "WebhookDelivery"
    USING ("tenantId" = current_setting('app.tenant_id', true));
