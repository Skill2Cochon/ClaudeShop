import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@claudeshop/db';
import type {
  ProductSearchHit,
  SearchRepository,
  UpsertProductEmbeddingInput,
} from '@claudeshop/core';

/**
 * Prisma + pgvector adapter for SearchRepository.
 *
 * Vector ops use `$queryRawUnsafe` because:
 *   - Prisma doesn't type the `vector` column (we declared it via raw SQL),
 *   - the pgvector literal syntax `'[0.1,0.2,…]'::vector` is not naturally
 *     serialisable as a bind parameter with the node-postgres driver Prisma
 *     uses today.
 *
 * SECURITY: the vector is validated + serialised here (no user-supplied
 * strings, only floats we produced server-side) so there is no injection
 * surface. tenantId and productId are always passed via $1/$2 bind params.
 */
export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertProductEmbedding(
    tenantId: string,
    input: UpsertProductEmbeddingInput,
  ): Promise<void> {
    if (input.vector.length !== input.dimensions) {
      throw new Error(
        `Vector length ${input.vector.length} does not match dimensions ${input.dimensions}`,
      );
    }
    const vectorLiteral = toVectorLiteral(input.vector);
    const id = randomUUID();

    // Upsert on unique (productId). The searchText + model + dims are
    // refreshed on every reindex; id is only generated on INSERT.
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "ProductEmbedding"
          ("id", "tenantId", "productId", "model", "dimensions",
           "searchText", "embedding", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW(), NOW())
      ON CONFLICT ("productId")
      DO UPDATE SET
          "tenantId"   = EXCLUDED."tenantId",
          "model"      = EXCLUDED."model",
          "dimensions" = EXCLUDED."dimensions",
          "searchText" = EXCLUDED."searchText",
          "embedding"  = EXCLUDED."embedding",
          "updatedAt"  = NOW()
      `,
      id,
      tenantId,
      input.productId,
      input.model,
      input.dimensions,
      input.searchText,
      vectorLiteral,
    );
  }

  async deleteProductEmbedding(_tenantId: string, productId: string): Promise<void> {
    await this.prisma.productEmbedding.deleteMany({ where: { productId } });
  }

  async searchProductsByVector(
    tenantId: string,
    vector: number[],
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]> {
    if (vector.length === 0) return [];
    const vectorLiteral = toVectorLiteral(vector);
    const limit = Math.max(1, Math.min(opts.limit, 50));

    // `<=>` returns cosine distance in [0, 2]; similarity = 1 - distance.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ productId: string; distance: number }>
    >(
      `
      SELECT "productId", ("embedding" <=> $2::vector) AS "distance"
      FROM   "ProductEmbedding"
      WHERE  "tenantId" = $1
      ORDER  BY "embedding" <=> $2::vector ASC
      LIMIT  $3
      `,
      tenantId,
      vectorLiteral,
      limit,
    );

    const minSim = opts.minSimilarity ?? -1;
    return rows
      .map((r) => ({
        productId: r.productId,
        similarity: 1 - Number(r.distance),
      }))
      .filter((hit) => hit.similarity >= minSim);
  }

  async findSimilarToProduct(
    tenantId: string,
    productId: string,
    opts: { limit: number; minSimilarity?: number },
  ): Promise<ProductSearchHit[]> {
    const limit = Math.max(1, Math.min(opts.limit, 50));

    // Self-join: find the source product's vector and order by distance
    // to every other product in the same tenant. Avoids a round-trip +
    // re-embedding because pgvector lets us reference the stored column
    // directly on both sides of the `<=>` operator.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ productId: string; distance: number }>
    >(
      `
      SELECT candidate."productId", (candidate."embedding" <=> source."embedding") AS "distance"
      FROM   "ProductEmbedding" source
      JOIN   "ProductEmbedding" candidate
        ON   candidate."tenantId" = source."tenantId"
       AND   candidate."productId" <> source."productId"
      WHERE  source."tenantId" = $1
        AND  source."productId" = $2
      ORDER  BY candidate."embedding" <=> source."embedding" ASC
      LIMIT  $3
      `,
      tenantId,
      productId,
      limit,
    );

    const minSim = opts.minSimilarity ?? -1;
    return rows
      .map((r) => ({
        productId: r.productId,
        similarity: 1 - Number(r.distance),
      }))
      .filter((hit) => hit.similarity >= minSim);
  }
}

/**
 * Serialise a JS number[] to the pgvector text format `[n1,n2,…]`. We use
 * `.toString()` rather than `JSON.stringify` to produce pgvector-friendly
 * numeric tokens (no quotes around numbers).
 */
function toVectorLiteral(vector: number[]): string {
  // Defensive: replace non-finite values (NaN/Infinity) with 0. A single
  // bad float would otherwise poison the entire row.
  const parts = vector.map((x) => (Number.isFinite(x) ? x.toString() : '0'));
  return `[${parts.join(',')}]`;
}
