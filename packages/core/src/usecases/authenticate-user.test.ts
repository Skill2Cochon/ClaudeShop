import { describe, expect, it, beforeEach } from 'vitest';
import { ConflictError, UnauthorizedError, ValidationError } from '@claudeshop/errors';
import type { AuthUser } from '@claudeshop/contracts/auth';
import type {
  AuthUserRepository,
  AuthUserWithHash,
  CreateAuthUserInput,
} from '../ports/auth-user-repository';
import type { PasswordHasher } from '../ports/password-hasher';
import type { Clock } from '../ports/clock';
import { authenticateUser } from './authenticate-user';
import { registerUser } from './register-user';

class InMemoryAuthUserRepository implements AuthUserRepository {
  private readonly users = new Map<string, AuthUserWithHash>();
  private readonly emailIndex = new Map<string, string>();

  async findByEmail(tenantId: string, email: string): Promise<AuthUserWithHash | null> {
    const id = this.emailIndex.get(`${tenantId}:${email}`);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findById(tenantId: string, id: string): Promise<AuthUser | null> {
    const u = this.users.get(id);
    if (!u || u.tenantId !== tenantId) return null;
    const { passwordHash: _strip, ...rest } = u;
    return rest;
  }

  async create(tenantId: string, input: CreateAuthUserInput): Promise<AuthUser> {
    const id = `usr${Math.random().toString(36).slice(2, 24).padEnd(22, '0')}`;
    const now = new Date().toISOString();
    const full: AuthUserWithHash = {
      id,
      tenantId,
      email: input.email,
      role: input.role,
      displayName: input.displayName ?? null,
      emailVerified: input.emailVerified ?? false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: input.passwordHash,
    };
    this.users.set(id, full);
    this.emailIndex.set(`${tenantId}:${input.email}`, id);
    const { passwordHash: _strip, ...rest } = full;
    return rest;
  }

  async updateLastLogin(tenantId: string, id: string, at: Date): Promise<void> {
    const u = this.users.get(id);
    if (!u || u.tenantId !== tenantId) return;
    u.lastLoginAt = at.toISOString();
  }
}

/** Fake hasher — "hash" is "plain:<password>", verify compares strings. */
class FakeHasher implements PasswordHasher {
  readonly name = 'fake';
  async hash(plain: string): Promise<string> {
    return `plain:${plain}`;
  }
  async verify(plain: string, hashed: string): Promise<boolean> {
    return hashed === `plain:${plain}`;
  }
}

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

describe('registerUser + authenticateUser', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let repo: InMemoryAuthUserRepository;
  let hasher: FakeHasher;
  const clock = new FixedClock(new Date('2026-04-19T12:00:00.000Z'));

  beforeEach(() => {
    repo = new InMemoryAuthUserRepository();
    hasher = new FakeHasher();
  });

  describe('registerUser', () => {
    it('creates a user with the given role + hashed password', async () => {
      const user = await registerUser(
        { email: 'owner@shop.local', password: 'hunter22!', displayName: 'Owner' },
        { tenantId, authUserRepo: repo, hasher, role: 'OWNER' },
      );
      expect(user.role).toBe('OWNER');
      expect(user.displayName).toBe('Owner');
      expect(user.tenantId).toBe(tenantId);
      const stored = await repo.findByEmail(tenantId, 'owner@shop.local');
      expect(stored?.passwordHash).toBe('plain:hunter22!');
    });

    it('defaults role to CUSTOMER when not specified', async () => {
      const user = await registerUser(
        { email: 'c@shop.local', password: 'hunter22!' },
        { tenantId, authUserRepo: repo, hasher },
      );
      expect(user.role).toBe('CUSTOMER');
    });

    it('rejects duplicate email in the same tenant', async () => {
      await registerUser(
        { email: 'dup@shop.local', password: 'hunter22!' },
        { tenantId, authUserRepo: repo, hasher },
      );
      await expect(
        registerUser(
          { email: 'dup@shop.local', password: 'hunter22!' },
          { tenantId, authUserRepo: repo, hasher },
        ),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('allows the same email across different tenants', async () => {
      await registerUser(
        { email: 'same@shop.local', password: 'hunter22!' },
        { tenantId, authUserRepo: repo, hasher },
      );
      const other = await registerUser(
        { email: 'same@shop.local', password: 'hunter22!' },
        { tenantId: 'tnt02h0000000000000000000', authUserRepo: repo, hasher },
      );
      expect(other.tenantId).toBe('tnt02h0000000000000000000');
    });

    it('rejects short passwords via Zod', async () => {
      await expect(
        registerUser(
          { email: 'x@shop.local', password: 'short' },
          { tenantId, authUserRepo: repo, hasher },
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('authenticateUser', () => {
    beforeEach(async () => {
      await registerUser(
        { email: 'admin@shop.local', password: 'hunter22!', displayName: 'Admin' },
        { tenantId, authUserRepo: repo, hasher, role: 'ADMIN' },
      );
    });

    it('returns the public user (no hash) on correct credentials', async () => {
      const user = await authenticateUser(
        { email: 'admin@shop.local', password: 'hunter22!' },
        { tenantId, authUserRepo: repo, hasher, clock },
      );
      expect(user.email).toBe('admin@shop.local');
      expect(user.role).toBe('ADMIN');
      // Ensure no hash leakage.
      expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('updates lastLoginAt on successful login', async () => {
      await authenticateUser(
        { email: 'admin@shop.local', password: 'hunter22!' },
        { tenantId, authUserRepo: repo, hasher, clock },
      );
      const stored = await repo.findByEmail(tenantId, 'admin@shop.local');
      expect(stored?.lastLoginAt).toBe('2026-04-19T12:00:00.000Z');
    });

    it('throws UnauthorizedError on wrong password', async () => {
      await expect(
        authenticateUser(
          { email: 'admin@shop.local', password: 'wrongpass' },
          { tenantId, authUserRepo: repo, hasher, clock },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when the user does not exist', async () => {
      await expect(
        authenticateUser(
          { email: 'ghost@shop.local', password: 'hunter22!' },
          { tenantId, authUserRepo: repo, hasher, clock },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError across tenants (same email, different tenant)', async () => {
      await expect(
        authenticateUser(
          { email: 'admin@shop.local', password: 'hunter22!' },
          { tenantId: 'tntOTHER', authUserRepo: repo, hasher, clock },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects malformed input via Zod', async () => {
      await expect(
        authenticateUser(
          { email: 'not-an-email', password: 'hunter22!' },
          { tenantId, authUserRepo: repo, hasher, clock },
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
