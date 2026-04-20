import type { PrismaClient } from '@claudeshop/db';
import type { AuthUser, UserRole } from '@claudeshop/contracts/auth';
import type {
  AuthUserRepository,
  AuthUserWithHash,
  CreateAuthUserInput,
} from '@claudeshop/core';

export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(tenantId: string, email: string): Promise<AuthUserWithHash | null> {
    const row = await this.prisma.authUser.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (!row) return null;
    return toDomainWithHash(row);
  }

  async findById(tenantId: string, id: string): Promise<AuthUser | null> {
    const row = await this.prisma.authUser.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    const full = toDomainWithHash(row);
    const { passwordHash: _strip, ...rest } = full;
    return rest;
  }

  async findByIdWithHash(
    tenantId: string,
    id: string,
  ): Promise<AuthUserWithHash | null> {
    const row = await this.prisma.authUser.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomainWithHash(row);
  }

  async create(tenantId: string, input: CreateAuthUserInput): Promise<AuthUser> {
    const row = await this.prisma.authUser.create({
      data: {
        tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        displayName: input.displayName ?? null,
        emailVerified: input.emailVerified ?? false,
      },
    });
    const full = toDomainWithHash(row);
    const { passwordHash: _strip, ...rest } = full;
    return rest;
  }

  async updateLastLogin(tenantId: string, id: string, at: Date): Promise<void> {
    await this.prisma.authUser.updateMany({
      where: { id, tenantId },
      data: { lastLoginAt: at },
    });
  }

  async updatePasswordHash(
    tenantId: string,
    id: string,
    hash: string,
  ): Promise<void> {
    await this.prisma.authUser.updateMany({
      where: { id, tenantId },
      data: { passwordHash: hash },
    });
  }
}

type Row = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string | null;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomainWithHash(row: Row): AuthUserWithHash {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    role: row.role,
    displayName: row.displayName,
    emailVerified: row.emailVerified,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    passwordHash: row.passwordHash,
  };
}
