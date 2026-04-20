import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@claudeshop/contracts/category';
import type { Product } from '@claudeshop/contracts/product';
import type { CategoryRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type CategoryRow = {
  id: string;
  tenantId: string;
  parentId: string | null;
  slug: string;
  name: unknown;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findBySlug(tenantId: string, slug: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      isActive?: boolean;
      parentId?: string | null;
    },
  ): Promise<{ items: Category[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.parentId !== undefined ? { parentId: opts.parentId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ position: 'asc' }, { slug: 'asc' }],
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreateCategoryInput): Promise<Category> {
    const row = await this.prisma.category.create({
      data: {
        tenantId,
        slug: input.slug,
        name: input.name,
        position: input.position ?? 0,
        isActive: input.isActive ?? true,
        parentId: input.parentId ?? null,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Category ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.name !== undefined) data.name = input.name;
    if (input.position !== undefined) data.position = input.position;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.parentId !== undefined) data.parentId = input.parentId;
    const row = await this.prisma.category.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.category.delete({ where: { id } });
  }

  async listProducts(
    tenantId: string,
    categoryId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: Product[]; total: number }> {
    const where = {
      tenantId,
      status: 'ACTIVE' as const,
      categories: { some: { categoryId } },
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { variants: true },
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    const items: Product[] = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      slug: row.slug,
      status: row.status,
      type: row.type,
      name: row.name as Record<string, string>,
      ...(row.description
        ? { description: row.description as Record<string, string> }
        : {}),
      ...(row.seo
        ? {
            seo: row.seo as {
              title?: Record<string, string>;
              description?: Record<string, string>;
            },
          }
        : {}),
      variants: row.variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        barcode: v.barcode,
        options: v.options as Record<string, string>,
        weight: v.weight ? v.weight.toString() : null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    return { items, total };
  }
}

function toDomain(row: CategoryRow): Category {
  return {
    id: row.id,
    tenantId: row.tenantId,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name as Record<string, string>,
    position: row.position,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
