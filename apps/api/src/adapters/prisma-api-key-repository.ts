import type { PrismaClient } from '@claudeshop/db';
import type {
  ApiKeyRepository,
  ApiKeyRow,
  CreateApiKeyInput,
} from '@claudeshop/core';

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string): Promise<ApiKeyRow[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return rows.map(toRow);
  }

  async create(tenantId: string, input: CreateApiKeyInput): Promise<ApiKeyRow> {
    const row = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: input.name,
        prefix: input.prefix,
        hashedKey: input.hashedKey,
        scopes: input.scopes,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return toRow(row);
  }

  async revoke(tenantId: string, id: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveByPrefix(prefix: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      name: string;
      hashedKey: string;
      scopes: string[];
    }>
  > {
    const rows = await this.prisma.apiKey.findMany({
      where: { prefix, revokedAt: null },
      select: {
        id: true,
        tenantId: true,
        name: true,
        hashedKey: true,
        scopes: true,
      },
    });
    return rows;
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: at },
    });
  }
}

type DbRow = {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

function toRow(row: DbRow): ApiKeyRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
