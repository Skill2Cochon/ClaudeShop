import { z } from 'zod';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { AuthUserRepository } from '../ports/auth-user-repository';
import type { PasswordHasher } from '../ports/password-hasher';

export const ChangePasswordInputSchema = z.object({
  userId: z.string().min(1),
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export interface ChangePasswordDeps {
  tenantId: string;
  authUserRepo: AuthUserRepository;
  hasher: PasswordHasher;
}

/**
 * Phase 59 — customer-initiated password change.
 *
 * Flow:
 *   1. Load the user (with hash) — 404 when missing.
 *   2. Verify the current password via the provided hasher.
 *   3. Reject when the new password matches the current one (UX
 *      guard; no point bumping a hash to the same material).
 *   4. Hash the new password and swap it atomically.
 *
 * Returns the public AuthUser (without hash) so callers can log a
 * user-scoped audit entry if they want.
 *
 * Wrong-current-password surfaces as a ValidationError with a
 * generic "incorrect password" message — we never hint at whether
 * the user exists or the new password is invalid separately,
 * because both paths need the same observable error to prevent
 * account enumeration.
 */
export async function changePassword(
  input: ChangePasswordInput,
  deps: ChangePasswordDeps,
): Promise<{ userId: string }> {
  const parsed = ChangePasswordInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid change-password input', {
      details: parsed.error.issues,
    });
  }

  const user = await deps.authUserRepo.findByIdWithHash(
    deps.tenantId,
    parsed.data.userId,
  );
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const ok = await deps.hasher.verify(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!ok) {
    // Uniform message — don't leak "wrong current" vs "weak new"
    // distinctions to a brute-force-style attacker.
    throw new ValidationError('Current password is incorrect');
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    throw new ValidationError(
      'New password must differ from the current one',
    );
  }

  const hash = await deps.hasher.hash(parsed.data.newPassword);
  await deps.authUserRepo.updatePasswordHash(
    deps.tenantId,
    parsed.data.userId,
    hash,
  );

  return { userId: parsed.data.userId };
}
