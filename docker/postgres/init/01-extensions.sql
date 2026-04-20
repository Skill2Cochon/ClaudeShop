-- ClaudeShop — PostgreSQL bootstrap extensions
-- Runs once on first container start (docker-entrypoint-initdb.d).
-- Idempotent: CREATE EXTENSION IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";        -- Category tree paths
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for semantic search (Product.embedding)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Fuzzy text search (admin search helpers)
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- GIN indexes on btree types
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- GIST indexes on btree types
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query perf observability

-- Grants baseline for app role (Prisma migrations will refine per-table).
-- NOTE: the claudeshop role is created by the container itself via POSTGRES_USER env.
-- This script runs AS superuser during initdb.
