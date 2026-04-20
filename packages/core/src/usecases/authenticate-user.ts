import { ValidationError, UnauthorizedError } from '@claudeshop/errors';
import { LoginInputSchema, type AuthUser, type LoginInput } from '@claudeshop/contracts/auth';
import type { AuthUserRepository } from '../ports/auth-user-repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { Clock } from '../ports/clock.js';

export interface AuthenticateUserDeps {
  tenantId: string;
  authUserRepo: AuthUserRepository;
  hasher: PasswordHasher;
  clock: Clock;
}

/**
 * Verify an email/password pair against the tenant's AuthUser table. On
 * success, touches lastLoginAt and returns the public user contract (no
 * hash). On failure, throws UnauthorizedError with a generic message so
 * callers can't distinguish "wrong password" from "unknown email" (timing-
 * equivalent via hasher.verify on a dummy hash when the user is absent).
 */
export async function authenticateUser(
  input: LoginInput,
  deps: AuthenticateUserDeps,
): Promise<AuthUser> {
  const parsed = LoginInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid login input', { details: parsed.error.issues });
  }

  const user = await deps.authUserRepo.findByEmail(deps.tenantId, parsed.data.email);

  // Compare against a known-invalid hash when the user is absent so timing
  // stays constant regardless of whether the email exists.
  const candidateHash = user?.passwordHash ?? DUMMY_INVALID_HASH;
  const ok = await deps.hasher.verify(parsed.data.password, candidateHash);

  if (!ok || !user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await deps.authUserRepo.updateLastLogin(deps.tenantId, user.id, deps.clock.now());

  // Strip the password hash before returning.
  const { passwordHash: _strip, ...publicUser } = user;
  return publicUser;
}

// A well-formed bcrypt hash of an impossible password. Used only to keep
// hasher.verify timing uniform when the user doesn't exist.
const DUMMY_INVALID_HASH =
  '$2b$12$0000000000000000000000000000000000000000000000000000';
