import { describe, expect, it, beforeEach } from 'vitest';
import type { Product } from '@claudeshop/contracts/product';
import { NotFoundError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository.js';
import { InMemorySearchRepository } from '../adapters/in-memory-search-repository.js';
import { StubEmbeddingProvider } from '../adapters/stub-embedding-provider.js';
import { indexProductEmbedding } from './index-product-embedding.js';

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

function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date('2026-04-19T00:00:00.000Z').toISOString();
  return {
    id: 'cmp01h0000000000000000000',
    tenantId: 'tnt01h0000000000000000000',
    slug: 'organic-cotton-tee',
    status: 'ACTIVE',
    type: 'VARIABLE',
    name: { en: 'Organic Cotton Tee', fr: 'T-shirt coton bio' },
    description: {
      en: 'Soft organic cotton tee designed for everyday comfort.',
      fr: 'T-shirt en coton biologique doux et confortable.',
    },
    variants: [
      {
        id: 'v1',
        productId: 'cmp01h0000000000000000000',
        sku: 'TEE-S-BLK',
        barcode: null,
        options: { size: 'S', color: 'black' },
        weight: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('indexProductEmbedding use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const productId = 'cmp01h0000000000000000000';
  let repo: StubProductRepository;
  let searchRepo: InMemorySearchRepository;
  let embedder: StubEmbeddingProvider;

  beforeEach(() => {
    repo = new StubProductRepository();
    searchRepo = new InMemorySearchRepository();
    embedder = new StubEmbeddingProvider(128);
    repo.seed(makeProduct());
  });

  it('builds searchable text from name + description + variant options and upserts an embedding', async () => {
    const result = await indexProductEmbedding(
      { productId },
      { tenantId, productRepo: repo, searchRepo, embedder },
    );

    expect(result.productId).toBe(productId);
    expect(result.dimensions).toBe(128);
    expect(result.model).toBe('stub-sha256');
    expect(result.searchText).toContain('Organic Cotton Tee');
    expect(result.searchText).toContain('T-shirt coton bio');
    expect(result.searchText).toContain('Soft organic cotton');
    expect(result.searchText).toContain('size: S');
    expect(result.searchText).toContain('color: black');
  });

  it('persists the embedding so it can be searched later', async () => {
    await indexProductEmbedding(
      { productId },
      { tenantId, productRepo: repo, searchRepo, embedder },
    );

    const { vector } = await embedder.embedOne({
      text: 'organic cotton tee',
      inputType: 'query',
    });
    const hits = await searchRepo.searchProductsByVector(tenantId, vector, { limit: 5 });
    expect(hits.length).toBe(1);
    expect(hits[0]?.productId).toBe(productId);
  });

  it('re-indexing replaces the previous embedding', async () => {
    await indexProductEmbedding(
      { productId },
      { tenantId, productRepo: repo, searchRepo, embedder },
    );
    await indexProductEmbedding(
      { productId },
      { tenantId, productRepo: repo, searchRepo, embedder },
    );

    const { vector } = await embedder.embedOne({ text: 'anything' });
    const hits = await searchRepo.searchProductsByVector(tenantId, vector, { limit: 10 });
    expect(hits.filter((h) => h.productId === productId)).toHaveLength(1);
  });

  it('throws NotFoundError when the product does not exist', async () => {
    await expect(
      indexProductEmbedding(
        { productId: 'cmpMISSING' },
        { tenantId, productRepo: repo, searchRepo, embedder },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the product belongs to a different tenant', async () => {
    await expect(
      indexProductEmbedding(
        { productId },
        { tenantId: 'tntOTHER', productRepo: repo, searchRepo, embedder },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
