-- ClaudeShop — PostgreSQL roles
-- The 'claudeshop' role is already the OWNER (from POSTGRES_USER).
-- This script creates additional roles for least-privilege access.

-- Read-only role for analytics/reporting tools (future).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'claudeshop_readonly') THEN
    CREATE ROLE claudeshop_readonly WITH LOGIN PASSWORD 'readonly';
    GRANT CONNECT ON DATABASE claudeshop TO claudeshop_readonly;
    GRANT USAGE ON SCHEMA public TO claudeshop_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claudeshop_readonly;
  END IF;
END $$;

-- App role used by runtime queries (enforces RLS).
-- Prisma migrations run as owner; the app connects with this role to trigger RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'claudeshop_app') THEN
    CREATE ROLE claudeshop_app WITH LOGIN PASSWORD 'app';
    GRANT CONNECT ON DATABASE claudeshop TO claudeshop_app;
    GRANT USAGE ON SCHEMA public TO claudeshop_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO claudeshop_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO claudeshop_app;
  END IF;
END $$;
