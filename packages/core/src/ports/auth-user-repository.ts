import type { AuthUser, UserRole } from '@claudeshop/contracts/auth';

export interface CreateAuthUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName?: string;
  emailVerified?: boolean;
}

/**
 * The full auth record including the password hash. Isolated from the
 * public AuthUser contract so the hash never leaks into API responses.
 */
export interface AuthUserWithHash extends AuthUser {
  passwordHash: string;
}

export interface AuthUserRepository {
  findByEmail(tenantId: string, email: string): Promise<AuthUserWithHash | null>;
  findById(tenantId: string, id: string): Promise<AuthUser | null>;
  /** Phase 59 — same shape as findById but exposes the hash for
   * current-password verification in change-password flows. */
  findByIdWithHash(
    tenantId: string,
    id: string,
  ): Promise<AuthUserWithHash | null>;
  create(tenantId: string, input: CreateAuthUserInput): Promise<AuthUser>;
  updateLastLogin(tenantId: string, id: string, at: Date): Promise<void>;
  /** Phase 59 — atomic bcrypt-hash swap. Fails loudly if the user
   * disappeared mid-flight (token / concurrent delete). */
  updatePasswordHash(
    tenantId: string,
    id: string,
    hash: string,
  ): Promise<void>;
}
