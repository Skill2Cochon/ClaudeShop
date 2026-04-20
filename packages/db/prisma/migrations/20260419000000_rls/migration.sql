-- ClaudeShop — Row-Level Security policies
-- Apply after the initial Prisma-generated migration.
--
-- Strategy: shared DB + tenantId column + RLS.
-- The app connects as `claudeshop_app` role and sets `app.tenant_id`
-- at the beginning of each request via Prisma middleware.
-- Policies deny access when `app.tenant_id` is not set (deny-by-default).

-- 1. Enable RLS on tenanted tables
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Variant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the owner role (otherwise the table owner bypasses it).
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Variant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

-- 2. Helper: read tenant from the current transaction setting.
--    Returns NULL if unset, which the policies treat as "deny".
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text AS $$
  SELECT current_setting('app.tenant_id', true);
$$ LANGUAGE sql STABLE;

-- 3. Policies — direct tenantId match
CREATE POLICY tenant_isolation_product ON "Product"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_customer ON "Customer"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_order ON "Order"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_audit ON "AuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- 4. Variant — scoped through its Product
CREATE POLICY tenant_isolation_variant ON "Variant"
  USING (EXISTS (
    SELECT 1 FROM "Product" p
    WHERE p.id = "Variant"."productId"
      AND p."tenantId" = current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Product" p
    WHERE p.id = "Variant"."productId"
      AND p."tenantId" = current_tenant_id()
  ));

-- 5. Audit log INSERT-only enforcement
--    Revoke UPDATE/DELETE from the app role.
REVOKE UPDATE, DELETE ON "AuditLog" FROM claudeshop_app;

-- 6. Bypass role for admin tooling (Prisma Studio, migrations).
--    The owner role (claudeshop) can disable FORCE by using a session setting.
--    Admins should always connect via a role WITHOUT FORCE RLS privileges.
