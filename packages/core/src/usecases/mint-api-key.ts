import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ValidationError } from '@claudeshop/errors';
import type {
  ApiKeyRepository,
  ApiKeyRow,
} from '../ports/api-key-repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';

export const MintApiKeyInputSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string().min(1).max(64)).max(32).optional(),
});
export type MintApiKeyInput = z.infer<typeof MintApiKeyInputSchema>;

export interface MintApiKeyDeps {
  tenantId: string;
  repo: ApiKeyRepository;
  hasher: PasswordHasher;
  /** Clock injection point for deterministic tests. Defaults to randomBytes. */
  generateSecret?: () => string;
}

/**
 * The raw string we hand back to the caller. Shape: `cs_<prefix><body>`
 * where prefix is 8 lower-case hex chars and body is 40 more. The `cs_`
 * prefix signals platform-origin in logs and lets downstream services
 * strip the envelope if they want to.
 */
export interface MintApiKeyResult {
  /** Public row — no hash, safe to return to the UI. */
  row: ApiKeyRow;
  /**
   * The raw key. Shown to the user EXACTLY ONCE. Server never stores
   * this; only the bcrypt hash lands in the DB.
   */
  rawKey: string;
}

export async function mintApiKey(
  input: MintApiKeyInput,
  deps: MintApiKeyDeps,
): Promise<MintApiKeyResult> {
  const parsed = MintApiKeyInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid mintApiKey input', {
      details: parsed.error.issues,
    });
  }

  const generate = deps.generateSecret ?? defaultSecret;
  const raw = generate();
  const prefix = raw.slice(3, 11); // chars after 'cs_', first 8 hex
  const hashedKey = await deps.hasher.hash(raw);

  const row = await deps.repo.create(deps.tenantId, {
    name: parsed.data.name,
    scopes: parsed.data.scopes ?? [],
    prefix,
    hashedKey,
  });

  return { row, rawKey: raw };
}

function defaultSecret(): string {
  // 24 bytes → 48 hex chars, plus the 'cs_' envelope = 51 chars total.
  return `cs_${randomBytes(24).toString('hex')}`;
}

/** Extract the 8-char prefix from a raw key. Returns null when shape is wrong. */
export function extractApiKeyPrefix(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('cs_')) return null;
  if (raw.length < 11) return null;
  return raw.slice(3, 11);
}
