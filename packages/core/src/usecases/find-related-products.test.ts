import { describe, expect, it, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { Product } from '@claudeshop/contracts/product';
import type { ProductRepository } from '../ports/product-repository';
import { InMemorySearchRepository } from '../adapters/in-memory-search-repository';
import { StubEmbeddingProvider } from '../adapters/stub-embedding-provider';
import { findRelatedProducts } from './find-related-products';

class StubProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  seed(product: Product): void {
    this.products.set(product.id, product);
  }

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }

  async findBySlug(): Promise<Product | null> {
    return null;
  }

  async list(): Promise<{ items: Product[]; total: number }> {
    return { items: [], total: 0 };
  }

  async create(): Promise<Product> {
    throw new Error('not used');
  }

  async update(): Promise<Product> {
    throw new Error('not used');
  }

  async archive(): Promise<void> {
    throw new Error('not used');
  }
}

function makeProduct(id: string, tenantId: string, name = id): Product {
  const now = new Date('2026-04-19T00:00:00.000Z').toISOString();
  return {
    id,
    tenantId,
    slug: id,
    status: 'ACTIVE',
    type: 'VARIABLE',
    name: { en: name },
    variants: [
      {
        id: `${id}-v1`,
        productId: id,
        sku: `${id}-SKU`,
        barcode: null,
        options: {},
        weight: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe('findRelatedProducts use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let productRepo: StubProductRepository;
  let searchRepo: InMemorySearchRepository;
  let embedder: StubEmbeddingProvider;

  beforeEach(async () => {
    productRepo = new StubProductRepository();
    searchRepo = new InMemorySearchRepository();
    embedder = new StubEmbeddingProvider(64);

    for (const id of ['pA', 'pB', 'pC', 'pD']) {
      productRepo.seed(makeProduct(id, tenantId, `Product ${id}`));
      const { vector, model, dimensions } = await embedder.embedOne({
        text: `Product ${id} searchable text`,
        inputType: 'document',
      });
      await searchRepo.upsertProductEmbedding(tenantId, {
        productId: id,
        model,
        dimensions,
        vector,
        searchText: `Product ${id} searchable text`,
      });
    }
  });

  it('excludes the source product from the results', async () => {
    const result = await findRelatedProducts(
      { productId: 'pA', limit: 10 },
      { tenantId, productRepo, searchRepo },
    );
    expect(result.hits.find((h) => h.productId === 'pA')).toBeUndefined();
  });

  it('returns hits sorted by similarity descending', async () => {
    const result = await findRelatedProducts(
      { productId: 'pA', limit: 10 },
      { tenantId, productRepo, searchRepo },
    );
    const sims = result.hits.map((h) => h.similarity);
    for (let i = 1; i < sims.length; i++) {
      expect(sims[i - 1]).toBeGreaterThanOrEqual(sims[i]!);
    }
  });

  it('respects the limit parameter', async () => {
    const result = await findRelatedProducts(
      { productId: 'pA', limit: 2 },
      { tenantId, productRepo, searchRepo },
    );
    expect(result.hits.length).toBeLessThanOrEqual(2);
  });

  it('throws NotFoundError when the source product does not exist', async () => {
    await expect(
      findRelatedProducts(
        { productId: 'pMISSING', limit: 5 },
        { tenantId, productRepo, searchRepo },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the source product belongs to a different tenant', async () => {
    await expect(
      findRelatedProducts(
        { productId: 'pA', limit: 5 },
        { tenantId: 'tntOTHER', productRepo, searchRepo },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns an empty array when the product has no embedding yet', async () => {
    productRepo.seed(makeProduct('pNew', tenantId, 'Not Indexed Yet'));
    const result = await findRelatedProducts(
      { productId: 'pNew', limit: 5 },
      { tenantId, productRepo, searchRepo },
    );
    expect(result.hits).toEqual([]);
  });

  it('defaults limit to 4 when not supplied', async () => {
    const result = await findRelatedProducts(
      { productId: 'pA' },
      { tenantId, productRepo, searchRepo },
    );
    expect(result.hits.length).toBeLessThanOrEqual(4);
  });

  it('caps limit at 20 to protect the DB', async () => {
    const result = await findRelatedProducts(
      { productId: 'pA', limit: 999 },
      { tenantId, productRepo, searchRepo },
    );
    expect(result.hits.length).toBeLessThanOrEqual(20);
  });

  it('rejects empty productId via Zod', async () => {
    await expect(
      findRelatedProducts(
        { productId: '', limit: 5 },
        { tenantId, productRepo, searchRepo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
