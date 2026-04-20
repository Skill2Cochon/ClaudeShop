import { ConflictError, ValidationError } from '@claudeshop/errors';
import {
  RegisterInputSchema,
  type AuthUser,
  type RegisterInput,
  type UserRole,
} from '@claudeshop/contracts/auth';
import type { AuthUserRepository } from '../ports/auth-user-repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';

export interface RegisterUserDeps {
  tenantId: string;
  authUserRepo: AuthUserRepository;
  hasher: PasswordHasher;
  /** Role to assign — defaults to CUSTOMER. Admin routes pass ADMIN/OWNER explicitly. */
  role?: UserRole;
}

/**
 * Create a new AuthUser in the tenant's scope. Throws ConflictError if the
 * email is already taken within that tenant. Returns the public user
 * contract (no hash).
 */
export async function registerUser(
  input: RegisterInput,
  deps: RegisterUserDeps,
): Promise<AuthUser> {
  const parsed = RegisterInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid registration input', {
      details: parsed.error.issues,
    });
  }

  const existing = await deps.authUserRepo.findByEmail(deps.tenantId, parsed.data.email);
  if (existing) {
    throw new ConflictError(`User with email ${parsed.data.email} already exists`, {
      details: { email: parsed.data.email },
    });
  }

  const passwordHash = await deps.hasher.hash(parsed.data.password);

  return deps.authUserRepo.create(deps.tenantId, {
    email: parsed.data.email,
    passwordHash,
    role: deps.role ?? 'CUSTOMER',
    ...(parsed.data.displayName !== undefined
      ? { displayName: parsed.data.displayName }
      : {}),
  });
}
