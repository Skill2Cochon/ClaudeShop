import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  SystemClock,
  authenticateUser,
  changePassword,
  registerUser,
  type AuditLogRepository,
  type AuthUserRepository,
  type PasswordHasher,
} from '@claudeshop/core';
import { UserRoleSchema } from '@claudeshop/contracts/auth';
import { recordFromRequest } from '../audit/record';

export interface AuthRoutesDeps {
  authUserRepo: AuthUserRepository;
  hasher: PasswordHasher;
  auditLogRepo: AuditLogRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Auth endpoints — the admin app (and later, the storefront) POSTs here to
 * exchange an email/password for the verified user record. The caller is
 * responsible for writing the session cookie on its own side (the admin uses
 * iron-session). This keeps the API stateless and lets us swap session
 * mechanisms without a second round-trip.
 */
export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const clock = new SystemClock();

  const UserResponseSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    email: z.string(),
    role: UserRoleSchema,
    displayName: z.string().nullable(),
    emailVerified: z.boolean(),
    lastLoginAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });

  zApp.post(
    '/v1/auth/login',
    {
      schema: {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8).max(256),
        }),
        response: { 200: z.object({ data: UserResponseSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const user = await authenticateUser(
        { email: request.body.email, password: request.body.password },
        { tenantId, authUserRepo: deps.authUserRepo, hasher: deps.hasher, clock },
      );
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        actorId: user.id,
        action: 'auth.login',
        resourceType: 'auth_user',
        resourceId: user.id,
        diff: { email: user.email, role: user.role },
      });
      return { data: user };
    },
  );

  zApp.post(
    '/v1/auth/register',
    {
      schema: {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8).max(256),
          displayName: z.string().min(1).max(120).optional(),
        }),
        response: { 201: z.object({ data: UserResponseSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const user = await registerUser(request.body, {
        tenantId,
        authUserRepo: deps.authUserRepo,
        hasher: deps.hasher,
        role: 'CUSTOMER',
      });
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        actorId: user.id,
        action: 'auth.register',
        resourceType: 'auth_user',
        resourceId: user.id,
        diff: { email: user.email, role: user.role },
      });
      return reply.status(201).send({ data: user });
    },
  );

  // Phase 59 — customer-initiated password change. The caller is
  // whatever layer holds the session (admin iron-session or the
  // storefront server action); it passes userId along with the two
  // passwords and we do the verify + hash + swap here.
  zApp.post(
    '/v1/auth/change-password',
    {
      schema: {
        body: z.object({
          userId: z.string().min(1),
          currentPassword: z.string().min(1).max(256),
          newPassword: z.string().min(8).max(256),
        }),
        response: {
          200: z.object({ data: z.object({ userId: z.string() }) }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const result = await changePassword(request.body, {
        tenantId,
        authUserRepo: deps.authUserRepo,
        hasher: deps.hasher,
      });
      // Best-effort audit. Change-password failures already threw
      // before this line, so reaching here means the hash swapped.
      await recordFromRequest(deps.auditLogRepo, request, tenantId, {
        actorType: 'user',
        actorId: result.userId,
        action: 'auth.password.change',
        resourceType: 'auth_user',
        resourceId: result.userId,
      });
      return { data: result };
    },
  );

  zApp.get(
    '/v1/auth/me',
    {
      schema: {
        querystring: z.object({ userId: z.string().min(1) }),
        response: {
          200: z.object({ data: UserResponseSchema.nullable() }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const user = await deps.authUserRepo.findById(tenantId, request.query.userId);
      return { data: user };
    },
  );
}
