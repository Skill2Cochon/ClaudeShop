import { describe, expect, it, beforeEach } from 'vitest';
import type { CreateProductInput, Product } from '@claudeshop/contracts/product';
import { ConflictError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type { Clock } from '../ports/clock';
import { createProduct } from './create-product';

/** In-memory ProductRepository for TDD. */
class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();
  private readonly slugIndex = new Map<string, string>(); // tenantId:slug -> id

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<Product | null> {
    const id = this.slugIndex.get(`${tenantId}:${slug}`);
    return id ? (this.products.get(id) ?? null) : null;
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: Product['status'] },
  ): Promise<{ items: Product[]; total: number }> {
    const all = [...this.products.values()].filter(
      (p) => p.tenantId === tenantId && (!opts.status || p.status === opts.status),
    );
    const offset = (opts.page - 1) * opts.limit;
    return { items: all.slice(offset, offset + opts.limit), total: all.length };
  }

  async create(tenantId: string, input: CreateProductInput): Promise<Product> {
    const id = `cm${Math.random().toString(36).slice(2, 24).padEnd(22, '0')}`;
    const now = new Date().toISOString();
    const product: Product = {
      id,
      tenantId,
      slug: input.slug,
      status: input.status,
      type: input.type,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.seo ? { seo: input.seo } : {}),
      variants: input.variants.map((v, i) => ({
        id: `cmv${i}`.padEnd(24, '0'),
        productId: id,
        sku: v.sku,
        barcode: v.barcode ?? null,
        options: v.options ?? {},
        weight: v.weight ?? null,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(id, product);
    this.slugIndex.set(`${tenantId}:${input.slug}`, id);
    return product;
  }

  async update(): Promise<Product> {
    throw new Error('not implemented in tests');
  }

  async archive(): Promise<void> {
    throw new Error('not implemented in tests');
  }
}

/** Fixed Clock for deterministic timestamps. */
class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

describe('createProduct use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let repo: InMemoryProductRepository;
  const clock = new FixedClock(new Date('2026-04-18T10:00:00.000Z'));

  const validInput: CreateProductInput = {
    slug: 'hello-claudeshop-tee',
    status: 'ACTIVE',
    type: 'VARIABLE',
    name: { en: 'Hello ClaudeShop Tee', fr: 'T-shirt Hello ClaudeShop' },
    variants: [
      { sku: 'HCS-TEE-S', barcode: null, options: { size: 'S' }, weight: null },
      { sku: 'HCS-TEE-M', barcode: null, options: { size: 'M' }, weight: null },
    ],
  };

  beforeEach(() => {
    repo = new InMemoryProductRepository();
  });

  it('creates a product with the provided input scoped to the tenant', async () => {
    const product = await createProduct(validInput, { tenantId, repo, clock });

    expect(product.tenantId).toBe(tenantId);
    expect(product.slug).toBe('hello-claudeshop-tee');
    expect(product.status).toBe('ACTIVE');
    expect(product.type).toBe('VARIABLE');
    expect(product.name.en).toBe('Hello ClaudeShop Tee');
    expect(product.variants).toHaveLength(2);
    expect(product.variants[0]?.sku).toBe('HCS-TEE-S');
  });

  it('persists the product in the repository so it can be fetched by slug', async () => {
    const created = await createProduct(validInput, { tenantId, repo, clock });
    const found = await repo.findBySlug(tenantId, 'hello-claudeshop-tee');

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('throws ConflictError when the slug already exists in the same tenant', async () => {
    await createProduct(validInput, { tenantId, repo, clock });

    await expect(
      createProduct(validInput, { tenantId, repo, clock }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('allows the same slug across different tenants', async () => {
    const otherTenant = 'tnt02h0000000000000000000';
    await createProduct(validInput, { tenantId, repo, clock });

    const other = await createProduct(validInput, { tenantId: otherTenant, repo, clock });
    expect(other.tenantId).toBe(otherTenant);
  });

  it('rejects invalid input via Zod', async () => {
    const bad = {
      ...validInput,
      slug: 'Not A Valid Slug!', // contains spaces + caps + punctuation
    } as CreateProductInput;

    await expect(createProduct(bad, { tenantId, repo, clock })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('requires at least one variant', async () => {
    const bad = { ...validInput, variants: [] } as CreateProductInput;

    await expect(createProduct(bad, { tenantId, repo, clock })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
