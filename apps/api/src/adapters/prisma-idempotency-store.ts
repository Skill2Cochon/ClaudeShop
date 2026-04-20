import type { IdempotencyRecord, IdempotencyStore } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';

/**
 * Postgres-backed IdempotencyStore. Expired rows are swept by a cron job
 * (Phase 2.5) — this adapter treats expired records as absent on read and
 * does NOT mutate them on get() (cleanup is background-only).
 */
export class PrismaIdempotencyStore implements IdempotencyStore {
  private readonly defaultTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaClient,
    defaultTtlSeconds: number = 24 * 60 * 60,
  ) {
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  async get(tenantId: string, key: string, route: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_key_route: { tenantId, key, route } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return {
      requestHash: row.requestHash,
      responseStatus: row.responseStatus,
      responseBody: row.responseBody,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async save(
    tenantId: string,
    key: string,
    route: string,
    record: Pick<IdempotencyRecord, 'requestHash' | 'responseStatus' | 'responseBody'>,
    ttlSeconds?: number,
  ): Promise<void> {
    const now = new Date();
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    await this.prisma.idempotencyKey.upsert({
      where: { tenantId_key_route: { tenantId, key, route } },
      create: {
        tenantId,
        key,
        route,
        requestHash: record.requestHash,
        responseStatus: record.responseStatus,
        responseBody: record.responseBody as object,
        expiresAt,
      },
      update: {
        requestHash: record.requestHash,
        responseStatus: record.responseStatus,
        responseBody: record.responseBody as object,
        expiresAt,
      },
    });
  }

  /**
   * Background sweeper — called by cron to clean expired rows.
   * Returns the number of rows deleted. Single DELETE statement; runs in a
   * few ms even on hundreds of thousands of expired rows thanks to the
   * index on `expiresAt`.
   */
  async sweepExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
