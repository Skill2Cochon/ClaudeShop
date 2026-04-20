import { z } from 'zod';
import type { ProductRepository } from '../ports/product-repository.js';
import type { OrderRepository } from '../ports/order-repository.js';
import type { ModuleInstallationRepository } from '../ports/module-installation-repository.js';
import type { EmbeddingProvider } from '../ports/embedding-provider.js';
import type { SearchRepository } from '../ports/search-repository.js';
import type { AIProvider } from '../ports/ai-provider.js';
import type { AnalyticsRepository } from '../ports/analytics-repository.js';
import { searchProducts } from '../usecases/search-products.js';
import { generateProductCopy } from '../usecases/generate-product-copy.js';
import { indexProductEmbedding } from '../usecases/index-product-embedding.js';
import { CopilotToolRegistry } from './tool-registry.js';

export interface DefaultCopilotToolDeps {
  tenantId: string;
  productRepo: ProductRepository;
  orderRepo: OrderRepository;
  moduleRepo: ModuleInstallationRepository;
  searchRepo: SearchRepository;
  embedder: EmbeddingProvider;
  ai: AIProvider;
  analytics: AnalyticsRepository;
}

/**
 * The initial Phase 4.3 tool set — all read-only. Mutating tools (generate
 * copy, reindex, disable module) will follow in 4.3b with confirm-before-
 * execute semantics.
 *
 * Each tool returns a compact object that the LLM can reason about without
 * drowning in payload size.
 */
export function buildDefaultCopilotRegistry(
  deps: DefaultCopilotToolDeps,
): CopilotToolRegistry {
  const registry = new CopilotToolRegistry();

  // --- Products -----------------------------------------------------------

  registry.register({
    name: 'list_products',
    description:
      'List the most recent products in the current tenant. Returns slug, name, status, variant count.',
    risk: 'read',
    inputSchema: z.object({
      limit: z.number().int().positive().max(50).optional(),
      status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
    }),
    handler: async ({ limit, status }) => {
      const opts = { page: 1, limit: limit ?? 10, ...(status ? { status } : {}) };
      const { items, total } = await deps.productRepo.list(deps.tenantId, opts);
      return {
        total,
        items: items.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name.en ?? p.name.fr ?? Object.values(p.name)[0] ?? p.slug,
          status: p.status,
          type: p.type,
          variantCount: p.variants.length,
        })),
      };
    },
  });

  registry.register({
    name: 'get_product',
    description:
      'Fetch full details for one product by id (name in all locales, variants with options, SEO).',
    risk: 'read',
    inputSchema: z.object({ productId: z.string().min(1) }),
    handler: async ({ productId }) => {
      const product = await deps.productRepo.findById(deps.tenantId, productId);
      if (!product) return { found: false, productId };
      return {
        found: true,
        id: product.id,
        slug: product.slug,
        status: product.status,
        type: product.type,
        name: product.name,
        description: product.description ?? null,
        seo: product.seo ?? null,
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          options: v.options,
        })),
      };
    },
  });

  registry.register({
    name: 'search_products',
    description:
      'Semantic search for products. Returns the top matches sorted by cosine similarity. Use for fuzzy / natural-language queries; prefer list_products for simple "show me all".',
    risk: 'read',
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().positive().max(20).optional(),
    }),
    handler: async ({ query, limit }) => {
      const result = await searchProducts(
        { query, ...(limit !== undefined ? { limit } : {}) },
        {
          tenantId: deps.tenantId,
          searchRepo: deps.searchRepo,
          embedder: deps.embedder,
        },
      );
      return {
        query,
        model: result.model,
        hits: result.hits.map((h) => ({
          productId: h.productId,
          similarity: Number(h.similarity.toFixed(4)),
        })),
      };
    },
  });

  // --- Orders -------------------------------------------------------------

  registry.register({
    name: 'list_orders',
    description:
      'List the most recent orders in the current tenant. Returns number, status, total, customer email.',
    risk: 'read',
    inputSchema: z.object({
      limit: z.number().int().positive().max(50).optional(),
      status: z
        .enum([
          'DRAFT',
          'PENDING_PAYMENT',
          'PAID',
          'FULFILLING',
          'SHIPPED',
          'DELIVERED',
          'CANCELLED',
          'REFUNDED',
        ])
        .optional(),
    }),
    handler: async ({ limit, status }) => {
      const opts = { page: 1, limit: limit ?? 10, ...(status ? { status } : {}) };
      const { items, total } = await deps.orderRepo.list(deps.tenantId, opts);
      return {
        total,
        items: items.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          currency: o.currency,
          total: o.totals.total,
          customerEmail: o.anonymousEmail ?? null,
        })),
      };
    },
  });

  registry.register({
    name: 'get_order',
    description: 'Fetch full details for one order by id (lines, totals, status).',
    risk: 'read',
    inputSchema: z.object({ orderId: z.string().min(1) }),
    handler: async ({ orderId }) => {
      const order = await deps.orderRepo.findById(deps.tenantId, orderId);
      if (!order) return { found: false, orderId };
      return {
        found: true,
        id: order.id,
        number: order.number,
        status: order.status,
        currency: order.currency,
        totals: order.totals,
        placedAt: order.placedAt,
        lineCount: order.lines.length,
        lines: order.lines.map((l) => ({
          sku: l.sku,
          productName: l.productName,
          qty: l.qty,
          unitPrice: l.unitPrice,
          total: l.total,
        })),
      };
    },
  });

  // --- Modules ------------------------------------------------------------

  registry.register({
    name: 'list_modules',
    description:
      'List installed modules for the current tenant with their status (ACTIVE, DISABLED, FAILED).',
    risk: 'read',
    inputSchema: z.object({}),
    handler: async () => {
      const installations = await deps.moduleRepo.findByTenant(deps.tenantId);
      return {
        count: installations.length,
        items: installations.map((i) => ({
          moduleId: i.moduleId,
          version: i.version,
          status: i.status,
          lastError: i.lastError,
          activatedAt: i.activatedAt,
        })),
      };
    },
  });

  // --- Analytics (Phase 12.1, read-only) ----------------------------------

  registry.register({
    name: 'get_revenue_summary',
    description:
      'Total revenue, paid order count, currency, and per-day buckets over a window. Use this to answer "how was revenue this week / month?" type questions.',
    risk: 'read',
    inputSchema: z.object({
      days: z.number().int().positive().max(365).optional(),
    }),
    handler: async ({ days }) => {
      const summary = await deps.analytics.getRevenueSummary(deps.tenantId, {
        days: days ?? 30,
      });
      return {
        windowDays: days ?? 30,
        total: summary.total,
        currency: summary.currency,
        orderCount: summary.orderCount,
        averageOrderValue:
          summary.orderCount > 0
            ? (Number.parseFloat(summary.total) / summary.orderCount).toFixed(2)
            : '0.00',
        bucketsPreview: summary.buckets.slice(-7),
      };
    },
  });

  registry.register({
    name: 'get_top_products',
    description:
      'Top products by revenue over a window. Returns sku, name, units sold, revenue. Use to answer "what were my best sellers last month?" style questions.',
    risk: 'read',
    inputSchema: z.object({
      days: z.number().int().positive().max(365).optional(),
      limit: z.number().int().positive().max(20).optional(),
    }),
    handler: async ({ days, limit }) => {
      const items = await deps.analytics.getTopProducts(deps.tenantId, {
        days: days ?? 30,
        limit: limit ?? 5,
      });
      return { windowDays: days ?? 30, count: items.length, items };
    },
  });

  registry.register({
    name: 'get_inventory_health',
    description:
      'Inventory snapshot — total variants, out-of-stock count, low-stock count (≤ safetyStock), overstock count (> 1000 units). Use to answer "what should I reorder?" style questions.',
    risk: 'read',
    inputSchema: z.object({}),
    handler: async () => {
      return deps.analytics.getInventoryHealth(deps.tenantId);
    },
  });

  registry.register({
    name: 'get_order_status_breakdown',
    description:
      'Counts of orders by status (DRAFT, PAID, FULFILLING, SHIPPED, …) over a window. Use to surface fulfillment bottlenecks.',
    risk: 'read',
    inputSchema: z.object({
      days: z.number().int().positive().max(365).optional(),
    }),
    handler: async ({ days }) => {
      return deps.analytics.getOrderStatusBreakdown(deps.tenantId, {
        days: days ?? 30,
      });
    },
  });

  // --- Mutating tools (exposed only when allowMutations = true) -----------

  registry.register({
    name: 'reindex_product',
    description:
      'Regenerate the semantic-search embedding for one product. Use after the product copy, attributes, or variants change. Persists a new row in ProductEmbedding.',
    risk: 'mutating',
    inputSchema: z.object({ productId: z.string().min(1) }),
    handler: async ({ productId }) => {
      const result = await indexProductEmbedding(
        { productId },
        {
          tenantId: deps.tenantId,
          productRepo: deps.productRepo,
          searchRepo: deps.searchRepo,
          embedder: deps.embedder,
        },
      );
      return {
        productId: result.productId,
        model: result.model,
        dimensions: result.dimensions,
        inputTokens: result.inputTokens,
        searchTextPreview: result.searchText.slice(0, 180),
      };
    },
  });

  registry.register({
    name: 'generate_product_copy_suggestion',
    description:
      'Generate merchant-facing product copy (name, tagline, description, SEO) in multiple locales for an existing product. Returns the suggestion — does NOT persist it to the product record. The merchant reviews and saves from the Product detail page.',
    risk: 'mutating',
    inputSchema: z.object({
      productId: z.string().min(1),
      seed: z.string().min(1),
      tone: z
        .enum(['friendly', 'premium', 'technical', 'playful', 'minimal'])
        .optional(),
      audience: z.string().optional(),
      locales: z.array(z.string().min(2).max(10)).optional(),
    }),
    handler: async ({ productId, seed, tone, audience, locales }) => {
      const result = await generateProductCopy(
        {
          productId,
          seed,
          ...(tone !== undefined ? { tone } : {}),
          ...(audience !== undefined ? { audience } : {}),
          ...(locales !== undefined ? { locales } : {}),
        },
        { tenantId: deps.tenantId, productRepo: deps.productRepo, ai: deps.ai },
      );
      return {
        productId,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        suggestions: result.locales.map((l) => ({
          locale: l.locale,
          name: l.name,
          tagline: l.tagline,
          description: l.description,
          seoTitle: l.seo.title,
          seoDescription: l.seo.description,
        })),
      };
    },
  });

  return registry;
}
