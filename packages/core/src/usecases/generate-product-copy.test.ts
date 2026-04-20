import { describe, expect, it, beforeEach } from 'vitest';
import type { Product } from '@claudeshop/contracts/product';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type {
  AIProvider,
  GenerateProductCopyInput,
  ProductCopyResult,
} from '../ports/ai-provider';
import { generateProductCopy } from './generate-product-copy';

/** Minimal ProductRepository stub — only the methods this use-case touches. */
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
    throw new Error('not used in generate-product-copy tests');
  }

  async update(): Promise<Product> {
    throw new Error('not used in generate-product-copy tests');
  }

  async archive(): Promise<void> {
    throw new Error('not used in generate-product-copy tests');
  }
}

/** Recording AIProvider that captures the last input and returns a canned payload. */
class RecordingAIProvider implements AIProvider {
  readonly name = 'recording';
  lastInput?: GenerateProductCopyInput;
  private readonly response: ProductCopyResult;

  constructor(response: ProductCopyResult) {
    this.response = response;
  }

  async generateProductCopy(input: GenerateProductCopyInput): Promise<ProductCopyResult> {
    this.lastInput = input;
    return this.response;
  }
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date('2026-04-19T00:00:00.000Z').toISOString();
  return {
    id: 'cmp01h0000000000000000000',
    tenantId: 'tnt01h0000000000000000000',
    slug: 'hello-claudeshop-tee',
    status: 'ACTIVE',
    type: 'VARIABLE',
    name: { en: 'Hello ClaudeShop Tee' },
    variants: [
      {
        id: 'cmv01h0000000000000000000',
        productId: 'cmp01h0000000000000000000',
        sku: 'HCS-TEE-S',
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

describe('generateProductCopy use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  const productId = 'cmp01h0000000000000000000';
  let repo: StubProductRepository;
  let ai: RecordingAIProvider;

  const cannedResult: ProductCopyResult = {
    locales: [
      {
        locale: 'en',
        name: 'Hello ClaudeShop Tee',
        tagline: 'A tee that knows your brand.',
        description: 'Soft, breathable, designed for the long run.',
        seo: { title: 'Hello ClaudeShop Tee', description: 'Shop the tee.' },
      },
      {
        locale: 'fr',
        name: 'T-shirt Hello ClaudeShop',
        tagline: 'Le t-shirt qui parle votre marque.',
        description: 'Doux, respirant, conçu pour durer.',
        seo: { title: 'T-shirt Hello ClaudeShop', description: 'Achetez le t-shirt.' },
      },
    ],
    model: 'claude-sonnet-4-7',
    usage: { inputTokens: 200, outputTokens: 450 },
  };

  beforeEach(() => {
    repo = new StubProductRepository();
    ai = new RecordingAIProvider(cannedResult);
    repo.seed(makeProduct());
  });

  it('returns the AI provider result for an existing product in the tenant', async () => {
    const result = await generateProductCopy(
      { productId, seed: 'Cotton tee, easy everyday wear.', locales: ['en', 'fr'] },
      { tenantId, productRepo: repo, ai },
    );

    expect(result.model).toBe('claude-sonnet-4-7');
    expect(result.locales).toHaveLength(2);
    expect(result.locales[0]?.locale).toBe('en');
    expect(result.locales[1]?.locale).toBe('fr');
  });

  it('passes product-derived context (seed + attributes) to the AI provider', async () => {
    await generateProductCopy(
      {
        productId,
        seed: 'Cotton tee, easy everyday wear.',
        tone: 'friendly',
        locales: ['en'],
      },
      { tenantId, productRepo: repo, ai },
    );

    expect(ai.lastInput).toBeDefined();
    expect(ai.lastInput?.seed).toContain('Cotton tee');
    expect(ai.lastInput?.tone).toBe('friendly');
    expect(ai.lastInput?.locales).toEqual(['en']);
    // Options from the variant should be surfaced as attribute hints.
    expect(ai.lastInput?.attributes?.size).toBe('S');
    expect(ai.lastInput?.attributes?.color).toBe('black');
  });

  it('defaults locales to [en] when none provided', async () => {
    await generateProductCopy(
      { productId, seed: 'Cotton tee.' },
      { tenantId, productRepo: repo, ai },
    );

    expect(ai.lastInput?.locales).toEqual(['en']);
  });

  it('throws NotFoundError when the product does not exist in the tenant', async () => {
    await expect(
      generateProductCopy(
        { productId: 'cmpMISSING00000000000000', seed: 'anything' },
        { tenantId, productRepo: repo, ai },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the product belongs to a different tenant', async () => {
    await expect(
      generateProductCopy(
        { productId, seed: 'anything' },
        { tenantId: 'tntOTHER000000000000000', productRepo: repo, ai },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects empty seed via Zod', async () => {
    await expect(
      generateProductCopy(
        { productId, seed: '   ' },
        { tenantId, productRepo: repo, ai },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects unsupported tone values via Zod', async () => {
    await expect(
      generateProductCopy(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { productId, seed: 'ok', tone: 'snarky' as any },
        { tenantId, productRepo: repo, ai },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('caps locales at 4 to protect token budget', async () => {
    await generateProductCopy(
      {
        productId,
        seed: 'Cotton tee.',
        locales: ['en', 'fr', 'de', 'es', 'it', 'pt'],
      },
      { tenantId, productRepo: repo, ai },
    );

    expect(ai.lastInput?.locales).toHaveLength(4);
  });
});
