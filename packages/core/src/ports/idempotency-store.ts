export interface IdempotencyRecord {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. Records past expiry are treated as absent. */
  expiresAt: string;
}

/**
 * Store for Idempotency-Key records. Scoped per tenant + route + key.
 *
 * Default TTL is 24h — configurable at save() call site. In production this
 * is backed by Redis (fast, expiring) or Postgres (durable). The core ships
 * with an in-memory reference implementation for tests and single-instance
 * dev.
 */
export interface IdempotencyStore {
  /**
   * Returns the stored record for (tenantId, key, route) if it exists and
   * has not expired. Expired records are transparently evicted and reported
   * as null.
   */
  get(tenantId: string, key: string, route: string): Promise<IdempotencyRecord | null>;

  /**
   * Save a record. Idempotent at the storage layer: calling save twice with
   * the same primary key overwrites. Callers should only write once per
   * request (the Fastify plugin does this).
   */
  save(
    tenantId: string,
    key: string,
    route: string,
    record: Pick<IdempotencyRecord, 'requestHash' | 'responseStatus' | 'responseBody'>,
    ttlSeconds?: number,
  ): Promise<void>;
}
