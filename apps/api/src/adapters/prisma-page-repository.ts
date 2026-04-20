import type { PrismaClient } from '@claudeshop/db';
import type {
  CreatePageInput,
  Page,
  PageStatus,
  UpdatePageInput,
} from '@claudeshop/contracts/page';
import type { PageRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  slug: string;
  status: PageStatus;
  title: unknown;
  body: unknown;
  seo: unknown;
  publishedAt: Date | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaPageRepository implements PageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Page | null> {
    const row = await this.prisma.page.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findBySlug(tenantId: string, slug: string): Promise<Page | null> {
    const row = await this.prisma.page.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PageStatus },
  ): Promise<{ items: Page[]; total: number }> {
    const where = { tenantId, ...(opts.status ? { status: opts.status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.page.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(
    tenantId: string,
    input: CreatePageInput & { publishedAt?: Date },
  ): Promise<Page> {
    const row = await this.prisma.page.create({
      data: {
        tenantId,
        slug: input.slug,
        status: input.status,
        title: input.title,
        body: input.body,
        seo: input.seo ?? undefined,
        authorId: input.authorId ?? null,
        publishedAt: input.publishedAt ?? null,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdatePageInput,
  ): Promise<Page> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Page ${id} not found`);

    const { publish: _discard, ...rest } = input;
    const data: Record<string, unknown> = {};
    if (rest.slug !== undefined) data.slug = rest.slug;
    if (rest.status !== undefined) data.status = rest.status;
    if (rest.title !== undefined) data.title = rest.title;
    if (rest.body !== undefined) data.body = rest.body;
    if (rest.seo !== undefined) data.seo = rest.seo;
    if (rest.authorId !== undefined) data.authorId = rest.authorId ?? null;
    if (rest.status === 'PUBLISHED' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    const row = await this.prisma.page.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.page.delete({ where: { id } });
  }
}

function toDomain(row: Row): Page {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    status: row.status,
    title: row.title as Record<string, string>,
    body: row.body as Record<string, string>,
    seo: (row.seo as Page['seo']) ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    authorId: row.authorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
