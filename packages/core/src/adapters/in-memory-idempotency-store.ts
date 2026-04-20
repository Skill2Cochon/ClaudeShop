import type { IdempotencyRecord, IdempotencyStore } from '../ports/idempotency-store';

/**
 * In-memory IdempotencyStore for tests and single-instance dev deployments.
 * Production should swap this for a Redis-backed or Postgres-backed adapter.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, IdempotencyRecord>();
  private readonly defaultTtlSeconds: number;

  constructor(defaultTtlSeconds: number = 24 * 60 * 60) {
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  private compositeKey(tenantId: string, key: string, route: string): string {
    return `${tenantId}\x1f${key}\x1f${route}`;
  }

  async get(tenantId: string, key: string, route: string): Promise<IdempotencyRecord | null> {
    const storeKey = this.compositeKey(tenantId, key, route);
    const record = this.entries.get(storeKey);
    if (!record) return null;
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      this.entries.delete(storeKey);
      return null;
    }
    return record;
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
    this.entries.set(this.compositeKey(tenantId, key, route), {
      requestHash: record.requestHash,
      responseStatus: record.responseStatus,
      responseBody: record.responseBody,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }

  /** Test helper — drop everything. */
  public reset(): void {
    this.entries.clear();
  }

  /** Observability — current count (not exposed outside tests). */
  public size(): number {
    return this.entries.size;
  }
}
