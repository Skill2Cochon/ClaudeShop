import { describe, expect, it, beforeEach } from 'vitest';
import type { CreateProductInput, Product } from '@claudeshop/contracts/product';
import { ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository.js';
import type { Clock } from '../ports/clock.js';
import { importProductsBatch } from './import-products-batch.js';

class InMemoryProductRepository implements ProductRepository {
  readonly products = new Map<string, Product>();
  private readonly slugIndex = new Map<string, string>();

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }
  async findBySlug(tenantId: string, slug: string): Promise<Product | null> {
    const id = this.slugIndex.get(`${tenantId}:${slug}`);
    return id ? (this.products.get(id) ?? null) : null;
  }
  async list(): Promise<{ items: Product[]; total: number }> {
    return { items: [], total: 0 };
  }
  async create(tenantId: string, input: CreateProductInput): Promise<Product> {
    const id = `cm${Math.random().toString(36).slice(2, 24).padEnd(22, '0')}`;
    const now = '2026-04-19T00:00:00.000Z';
    const p: Product = {
      id,
      tenantId,
      slug: input.slug,
      status: input.status,
      type: input.type,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      variants: input.variants.map((v, i) => ({
        id: `v${i}`.padEnd(24, '0'),
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
    this.products.set(id, p);
    this.slugIndex.set(`${tenantId}:${input.slug}`, id);
    return p;
  }
  async update(): Promise<Product> {
    throw new Error('not used');
  }
  async archive(): Promise<void> {
    throw new Error('not used');
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

const tenantId = 'tnt01h0000000000000000000';
const clock = new FixedClock(new Date('2026-04-19T00:00:00.000Z'));

const validRow = (slug: string): CreateProductInput => ({
  slug,
  status: 'ACTIVE',
  type: 'SIMPLE',
  name: { en: slug },
  variants: [{ sku: `${slug}-SKU`, barcode: null, options: {}, weight: null }],
});

describe('importProductsBatch', () => {
  let repo: InMemoryProductRepository;

  beforeEach(() => {
    repo = new InMemoryProductRepository();
  });

  it('creates every valid row', async () => {
    const result = await importProductsBatch(
      { rows: [validRow('a'), validRow('b'), validRow('c')] },
      { tenantId, repo, clock },
    );
    expect(result.created).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errored).toBe(0);
    expect(result.total).toBe(3);
    expect(repo.products.size).toBe(3);
  });

  it('skips rows whose slug already exists (skip mode — default)', async () => {
    // Pre-seed "a".
    await importProductsBatch(
      { rows: [validRow('a')] },
      { tenantId, repo, clock },
    );

    const result = await importProductsBatch(
      { rows: [validRow('a'), validRow('b')] },
      { tenantId, repo, clock },
    );
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    const skipRow = result.rows.find((r) => r.status === 'skipped');
    expect(skipRow?.status).toBe('skipped');
    if (skipRow?.status === 'skipped') {
      expect(skipRow.slug).toBe('a');
    }
  });

  it('records a per-row error for invalid shapes without aborting the batch', async () => {
    const result = await importProductsBatch(
      {
        rows: [
          validRow('a'),
          { slug: 'Not A Valid Slug!', status: 'ACTIVE', type: 'SIMPLE', name: { en: 'x' }, variants: [] },
          validRow('c'),
        ],
      },
      { tenantId, repo, clock },
    );
    expect(result.created).toBe(2);
    expect(result.errored).toBe(1);
    const errorRow = result.rows.find((r) => r.status === 'error');
    expect(errorRow?.status).toBe('error');
    if (errorRow?.status === 'error') {
      expect(errorRow.rowIndex).toBe(1);
    }
  });

  it('aborts on first error when mode is "fail"', async () => {
    await expect(
      importProductsBatch(
        {
          mode: 'fail',
          rows: [
            validRow('a'),
            { slug: 'bad slug!!', status: 'ACTIVE', type: 'SIMPLE', name: { en: 'x' }, variants: [] },
            validRow('c'),
          ],
        },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects empty batches via Zod', async () => {
    await expect(
      importProductsBatch({ rows: [] }, { tenantId, repo, clock }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects batches larger than 500 rows', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => validRow(`bulk-${i}`));
    await expect(
      importProductsBatch({ rows: tooMany }, { tenantId, repo, clock }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
