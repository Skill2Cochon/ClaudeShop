-- Phase 4.2 — Semantic product search
--
-- Adds a ProductEmbedding row per product with a pgvector column + HNSW index
-- for cosine-similarity search. Prisma cannot declare the `vector` column type
-- natively, so we add it via raw SQL here. Application code talks to it via
-- $queryRaw in PrismaSearchRepository.

-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

-- Vector column (pgvector). Size matches the configured embedding dimension
-- at install time. Change via a follow-up migration if switching models.
ALTER TABLE "ProductEmbedding" ADD COLUMN "embedding" vector(1024);

-- CreateIndex
CREATE UNIQUE INDEX "ProductEmbedding_productId_key" ON "ProductEmbedding"("productId");

-- CreateIndex
CREATE INDEX "ProductEmbedding_tenantId_updatedAt_idx" ON "ProductEmbedding"("tenantId", "updatedAt" DESC);

-- HNSW index for fast cosine-distance search. `vector_cosine_ops` means the
-- `<=>` operator returns cosine distance (1 - cosine similarity).
CREATE INDEX "ProductEmbedding_embedding_hnsw_idx"
    ON "ProductEmbedding" USING hnsw (embedding vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "ProductEmbedding"
    ADD CONSTRAINT "ProductEmbedding_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security — mirrors the pattern used on other tenant-scoped tables.
ALTER TABLE "ProductEmbedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductEmbedding" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_product_embedding"
    ON "ProductEmbedding"
    USING ("tenantId" = current_setting('app.tenant_id', true));
