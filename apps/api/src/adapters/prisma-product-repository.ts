import type {
  CreateProductInput,
  Product,
  ProductStatus,
  UpdateProductInput,
} from '@claudeshop/contracts/product';
import type { ProductRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

/**
 * Prisma-backed adapter for the ProductRepository port.
 *
 * All methods are tenant-scoped. Callers must wrap invocations in
 * `withTenant()` so RLS enforces isolation even if a bug slips through.
 */
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async findBySlug(tenantId: string, slug: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: { variants: true },
    });
    if (!row) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: ProductStatus },
  ): Promise<{ items: Product[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
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
    return { items: rows.map(toDomain), total };
  }

  async create(tenantId: string, input: CreateProductInput): Promise<Product> {
    const row = await this.prisma.product.create({
      data: {
        tenantId,
        slug: input.slug,
        status: input.status,
        type: input.type,
        name: input.name,
        description: input.description ?? undefined,
        seo: input.seo ?? undefined,
        variants: {
          create: input.variants.map((v) => ({
            sku: v.sku,
            barcode: v.barcode ?? null,
            options: v.options ?? {},
            weight: v.weight ?? null,
          })),
        },
      },
      include: { variants: true },
    });
    return toDomain(row);
  }

  async update(tenantId: string, id: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Product ${id} not found`);

    const row = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.seo ? { seo: input.seo } : {}),
      },
      include: { variants: true },
    });
    return toDomain(row);
  }

  async archive(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Product ${id} not found`);
    await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}

type PrismaProductRow = Awaited<
  ReturnType<PrismaClient['product']['findUnique']>
> extends infer T
  ? T extends null
    ? never
    : T
  : never;

type PrismaProductWithVariants = NonNullable<
  Awaited<
    ReturnType<
      PrismaClient['product']['findUnique']
    > extends Promise<infer T>
      ? T
      : never
  >
> & {
  variants: NonNullable<
    Awaited<ReturnType<PrismaClient['variant']['findMany']>>
  >;
};

function toDomain(row: PrismaProductWithVariants): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    status: row.status,
    type: row.type,
    name: row.name as Record<string, string>,
    ...(row.description ? { description: row.description as Record<string, string> } : {}),
    ...(row.seo ? { seo: row.seo as { title?: Record<string, string>; description?: Record<string, string> } } : {}),
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
  };
}
