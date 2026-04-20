import type {
  ApiKeyRepository,
  ApiKeyVerified,
} from '../ports/api-key-repository';
import type { PasswordHasher } from '../ports/password-hasher';
import { extractApiKeyPrefix } from './mint-api-key';

export interface VerifyApiKeyDeps {
  repo: ApiKeyRepository;
  hasher: PasswordHasher;
  /** Clock for touchLastUsed. Defaults to `new Date()`. */
  now?: () => Date;
}

/**
 * Resolve a raw `cs_<prefix><body>` to its ApiKeyVerified row.
 *
 * Returns null when:
 *  - the string doesn't match the expected envelope shape
 *  - no active key with that prefix exists
 *  - every candidate's bcrypt hash rejects the raw body
 *
 * On success, `touchLastUsed` runs fire-and-forget — a DB hiccup here
 * shouldn't fail the caller's request.
 */
export async function verifyApiKey(
  rawKey: string,
  deps: VerifyApiKeyDeps,
): Promise<ApiKeyVerified | null> {
  const prefix = extractApiKeyPrefix(rawKey);
  if (!prefix) return null;

  const candidates = await deps.repo.findActiveByPrefix(prefix);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const ok = await deps.hasher.verify(rawKey, candidate.hashedKey);
    if (ok) {
      const now = (deps.now ?? (() => new Date()))();
      void deps.repo.touchLastUsed(candidate.id, now).catch(() => {
        // swallow — lastUsedAt is observability, not correctness
      });
      return {
        id: candidate.id,
        tenantId: candidate.tenantId,
        name: candidate.name,
        scopes: candidate.scopes,
      };
    }
  }
  return null;
}
