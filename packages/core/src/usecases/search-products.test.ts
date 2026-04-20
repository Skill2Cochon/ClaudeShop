import { describe, expect, it, beforeEach } from 'vitest';
import { ValidationError } from '@claudeshop/errors';
import { InMemorySearchRepository } from '../adapters/in-memory-search-repository';
import { StubEmbeddingProvider } from '../adapters/stub-embedding-provider';
import { searchProducts } from './search-products';

describe('searchProducts use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let searchRepo: InMemorySearchRepository;
  let embedder: StubEmbeddingProvider;

  beforeEach(async () => {
    searchRepo = new InMemorySearchRepository();
    embedder = new StubEmbeddingProvider(64);

    // Seed a few documents.
    for (const { id, text } of [
      { id: 'pA', text: 'Organic cotton tee black size M' },
      { id: 'pB', text: 'Wool sweater navy size L' },
      { id: 'pC', text: 'Leather belt brown size 32' },
    ]) {
      const { vector, model, dimensions } = await embedder.embedOne({
        text,
        inputType: 'document',
      });
      await searchRepo.upsertProductEmbedding(tenantId, {
        productId: id,
        model,
        dimensions,
        vector,
        searchText: text,
      });
    }
  });

  it('returns hits sorted by similarity with similarity in (-1, 1]', async () => {
    const result = await searchProducts(
      { query: 'Organic cotton tee black size M', limit: 3 },
      { tenantId, searchRepo, embedder },
    );

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]?.productId).toBe('pA');
    expect(result.hits[0]?.similarity).toBeGreaterThan(0.99);

    const sims = result.hits.map((h) => h.similarity);
    for (let i = 1; i < sims.length; i++) {
      expect(sims[i - 1]).toBeGreaterThanOrEqual(sims[i]!);
    }
  });

  it('respects the limit parameter', async () => {
    const result = await searchProducts(
      { query: 'anything', limit: 2 },
      { tenantId, searchRepo, embedder },
    );
    expect(result.hits.length).toBeLessThanOrEqual(2);
  });

  it('filters by minSimilarity', async () => {
    const result = await searchProducts(
      { query: 'Organic cotton tee black size M', limit: 5, minSimilarity: 0.999 },
      { tenantId, searchRepo, embedder },
    );
    expect(result.hits.every((h) => h.similarity >= 0.999)).toBe(true);
  });

  it('only returns hits for the requesting tenant', async () => {
    // Seed a doc in another tenant.
    const { vector, model, dimensions } = await embedder.embedOne({
      text: 'Organic cotton tee black size M',
    });
    await searchRepo.upsertProductEmbedding('tntOTHER', {
      productId: 'pOther',
      model,
      dimensions,
      vector,
      searchText: 'Organic cotton tee black size M',
    });

    const result = await searchProducts(
      { query: 'Organic cotton tee black size M', limit: 10 },
      { tenantId, searchRepo, embedder },
    );
    expect(result.hits.find((h) => h.productId === 'pOther')).toBeUndefined();
  });

  it('rejects empty query', async () => {
    await expect(
      searchProducts(
        { query: '  ', limit: 5 },
        { tenantId, searchRepo, embedder },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('defaults limit to 10 when not supplied', async () => {
    const result = await searchProducts(
      { query: 'something' },
      { tenantId, searchRepo, embedder },
    );
    expect(result.hits.length).toBeLessThanOrEqual(10);
  });

  it('caps limit at 50 to protect the DB', async () => {
    const result = await searchProducts(
      { query: 'something', limit: 999 },
      { tenantId, searchRepo, embedder },
    );
    expect(result.hits.length).toBeLessThanOrEqual(50);
  });
});
