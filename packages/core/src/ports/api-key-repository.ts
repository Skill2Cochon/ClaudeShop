/**
 * ApiKey repository port — hashes live in the DB, raw secrets never
 * leave the create call.
 */

export interface ApiKeyRow {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiKeyVerified {
  id: string;
  tenantId: string;
  name: string;
  scopes: string[];
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  prefix: string;
  hashedKey: string;
}

export interface ApiKeyRepository {
  /** List every API key in the tenant, most recent first. */
  list(tenantId: string): Promise<ApiKeyRow[]>;

  /** Persist a newly-minted key. Returns the public row (no hash). */
  create(tenantId: string, input: CreateApiKeyInput): Promise<ApiKeyRow>;

  /** Flip revokedAt to `now`. Idempotent — noop when already revoked. */
  revoke(tenantId: string, id: string): Promise<void>;

  /**
   * Lookup every active (non-revoked) key sharing a prefix. The caller
   * runs bcrypt.compare against each row's hash — there should only ever
   * be one match (prefix + full hash), but we return a list to handle
   * prefix collisions defensively.
   */
  findActiveByPrefix(prefix: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      name: string;
      hashedKey: string;
      scopes: string[];
    }>
  >;

  /** Touch lastUsedAt to track which keys are actually in use. */
  touchLastUsed(id: string, at: Date): Promise<void>;
}
