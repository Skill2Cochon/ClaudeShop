-- Phase 6 — CMS pages
--
-- Merchant-authored storefront content (landing, about, legal…) routed by
-- slug. Body is Markdown per-locale; SEO is optional per-locale.

CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Page_tenantId_slug_key" ON "Page"("tenantId", "slug");
CREATE INDEX "Page_tenantId_status_updatedAt_idx" ON "Page"("tenantId", "status", "updatedAt" DESC);
CREATE INDEX "Page_tenantId_publishedAt_idx" ON "Page"("tenantId", "publishedAt" DESC);

ALTER TABLE "Page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Page" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_page"
    ON "Page"
    USING ("tenantId" = current_setting('app.tenant_id', true));
