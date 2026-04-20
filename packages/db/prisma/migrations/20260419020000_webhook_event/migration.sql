-- Phase 2.6 — Webhook replay protection

CREATE TABLE "WebhookEvent" (
  "id"          TEXT         NOT NULL,
  "tenantId"    TEXT         NOT NULL,
  "provider"    TEXT         NOT NULL,
  "eventId"     TEXT         NOT NULL,
  "eventType"   TEXT         NOT NULL,
  "orderId"     TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key"
  ON "WebhookEvent" ("provider", "eventId");
CREATE INDEX "WebhookEvent_tenantId_processedAt_idx"
  ON "WebhookEvent" ("tenantId", "processedAt" DESC);
CREATE INDEX "WebhookEvent_orderId_idx" ON "WebhookEvent" ("orderId");

ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_event ON "WebhookEvent"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- INSERT-only — mirrors AuditLog pattern.
GRANT SELECT, INSERT ON "WebhookEvent" TO claudeshop_app;
