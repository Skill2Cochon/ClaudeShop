import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema } from '../common/primitives';

export const UserRoleSchema = z.enum(['OWNER', 'ADMIN', 'STAFF', 'CUSTOMER']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  email: z.string().email(),
  role: UserRoleSchema,
  displayName: z.string().nullable(),
  emailVerified: z.boolean(),
  lastLoginAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const SessionSchema = z.object({
  userId: CuidSchema,
  tenantId: CuidSchema,
  email: z.string().email(),
  role: UserRoleSchema,
  displayName: z.string().nullable(),
  /** Unix epoch seconds. */
  issuedAt: z.number().int().positive(),
});
export type Session = z.infer<typeof SessionSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = LoginInputSchema.extend({
  displayName: z.string().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** Roles allowed to access the admin app. */
export const ADMIN_ROLES = new Set<UserRole>(['OWNER', 'ADMIN', 'STAFF']);

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.has(role);
}
