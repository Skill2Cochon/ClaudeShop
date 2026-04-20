import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '@claudeshop/core';

/**
 * bcryptjs-backed PasswordHasher adapter. Pure JS implementation — no native
 * build step, so it runs unchanged inside Next.js edge + node serverless
 * environments.
 *
 * The cost factor defaults to 12 which is an appropriate 2026 baseline
 * (~200ms per hash on modern hardware). Raise it if your deployment
 * profiles show headroom.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  readonly name = 'bcrypt';
  constructor(private readonly rounds = 12) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    if (!hashed || hashed.length === 0) return false;
    try {
      return await bcrypt.compare(plain, hashed);
    } catch {
      return false;
    }
  }
}
