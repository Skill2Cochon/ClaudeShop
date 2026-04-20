-- Phase 8 — Tax + shipping rates (admin-CRUD only, no checkout integration yet)

CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "regionCode" TEXT,
    "postcodePattern" TEXT,
    "rateBp" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxRate_tenantId_countryCode_isActive_priority_idx"
    ON "TaxRate"("tenantId", "countryCode", "isActive", "priority" DESC);
CREATE INDEX "TaxRate_tenantId_name_idx" ON "TaxRate"("tenantId", "name");

ALTER TABLE "TaxRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tax_rate"
    ON "TaxRate"
    USING ("tenantId" = current_setting('app.tenant_id', true));


CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCodes" JSONB NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "basePriceCents" INTEGER NOT NULL DEFAULT 0,
    "minSubtotalCents" INTEGER,
    "freeShippingAboveCents" INTEGER,
    "estimatedDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingRate_tenantId_isActive_idx"
    ON "ShippingRate"("tenantId", "isActive");
CREATE INDEX "ShippingRate_tenantId_name_idx"
    ON "ShippingRate"("tenantId", "name");

ALTER TABLE "ShippingRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingRate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_shipping_rate"
    ON "ShippingRate"
    USING ("tenantId" = current_setting('app.tenant_id', true));
