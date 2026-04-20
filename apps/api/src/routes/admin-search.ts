import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  CustomerRepository,
  CustomerSegmentRepository,
  EmailCampaignRepository,
  ModuleInstallationRepository,
  OrderRepository,
  PageRepository,
  ProductRepository,
  PromotionRepository,
  SupplierRepository,
} from '@claudeshop/core';

export interface AdminSearchRoutesDeps {
  productRepo: ProductRepository;
  orderRepo: OrderRepository;
  customerRepo: CustomerRepository;
  segmentRepo: CustomerSegmentRepository;
  campaignRepo: EmailCampaignRepository;
  supplierRepo: SupplierRepository;
  pageRepo: PageRepository;
  promotionRepo: PromotionRepository;
  moduleRepo: ModuleInstallationRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

const ResultItemSchema = z.object({
  type: z.enum([
    'product',
    'order',
    'customer',
    'segment',
    'campaign',
    'supplier',
    'page',
    'promotion',
    'module',
  ]),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  href: z.string(),
});

export async function registerAdminSearchRoutes(
  app: FastifyInstance,
  deps: AdminSearchRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/search',
    {
      schema: {
        querystring: z.object({
          q: z.string().min(1).max(120),
          limit: z.coerce.number().int().positive().max(50).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(ResultItemSchema),
            meta: z.object({ query: z.string(), totalReturned: z.number() }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const q = request.query.q.trim();
      const qLower = q.toLowerCase();
      const limit = request.query.limit ?? 12;

      // Fan out lightweight reads in parallel. Each repository call returns
      // the small per-tenant slice the palette needs (top N), then we
      // narrow + score in JS. Phase 19.1 swaps in pgtrgm + a single
      // ranked SQL query when a tenant outgrows the in-memory match.
      const [products, orders, segments, campaigns, suppliers, pages, promotions, installations] =
        await Promise.all([
          deps.productRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.orderRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.segmentRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.campaignRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.supplierRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.pageRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.promotionRepo.list(tenantId, { page: 1, limit: 100 }),
          deps.moduleRepo.findByTenant(tenantId),
        ]);

      // Customer lookups by exact email so the palette can jump from a
      // customer-support workflow without scanning every customer.
      const customer = await deps.customerRepo.findByEmail(tenantId, q);

      const matches: Array<z.infer<typeof ResultItemSchema>> = [];

      const includes = (...parts: Array<string | undefined | null>): boolean =>
        parts.some((p) => typeof p === 'string' && p.toLowerCase().includes(qLower));

      for (const p of products.items) {
        const enName = p.name.en ?? Object.values(p.name)[0] ?? p.slug;
        if (!includes(p.slug, enName, ...Object.values(p.name))) continue;
        matches.push({
          type: 'product',
          id: p.id,
          title: enName,
          subtitle: `/${p.slug} · ${p.status}`,
          href: `/products/${encodeURIComponent(p.id)}`,
        });
      }

      for (const o of orders.items) {
        if (!includes(o.number, o.anonymousEmail ?? undefined)) continue;
        matches.push({
          type: 'order',
          id: o.id,
          title: `#${o.number}`,
          subtitle: `${o.status} · ${o.totals.total} ${o.currency}`,
          href: `/orders/${encodeURIComponent(o.id)}`,
        });
      }

      if (customer) {
        matches.push({
          type: 'customer',
          id: customer.id,
          title: customer.email,
          subtitle: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
          href: `/customers/${encodeURIComponent(customer.id)}`,
        });
      }

      for (const s of segments.items) {
        if (!includes(s.name, s.description ?? undefined)) continue;
        matches.push({
          type: 'segment',
          id: s.id,
          title: s.name,
          subtitle: `${s.customerCount} member${s.customerCount === 1 ? '' : 's'}`,
          href: `/segments/${encodeURIComponent(s.id)}`,
        });
      }

      for (const c of campaigns.items) {
        if (!includes(c.name, c.subject)) continue;
        matches.push({
          type: 'campaign',
          id: c.id,
          title: c.name,
          subtitle: `${c.status} · ${c.subject}`,
          href: `/campaigns/${encodeURIComponent(c.id)}`,
        });
      }

      for (const s of suppliers.items) {
        if (!includes(s.name, s.contactEmail ?? undefined)) continue;
        matches.push({
          type: 'supplier',
          id: s.id,
          title: s.name,
          subtitle: s.contactEmail ?? `${s.currency} · NET ${s.paymentTermsDays}`,
          href: `/suppliers/${encodeURIComponent(s.id)}`,
        });
      }

      for (const p of pages.items) {
        const enTitle = p.title.en ?? Object.values(p.title)[0] ?? p.slug;
        if (!includes(p.slug, enTitle, ...Object.values(p.title))) continue;
        matches.push({
          type: 'page',
          id: p.id,
          title: enTitle,
          subtitle: `/${p.slug} · ${p.status}`,
          href: `/pages/${encodeURIComponent(p.id)}`,
        });
      }

      for (const pr of promotions.items) {
        if (!includes(pr.code, pr.name)) continue;
        matches.push({
          type: 'promotion',
          id: pr.id,
          title: pr.code,
          subtitle: `${pr.name} · ${pr.status}`,
          href: `/promotions/${encodeURIComponent(pr.id)}`,
        });
      }

      for (const m of installations) {
        if (!includes(m.moduleId)) continue;
        matches.push({
          type: 'module',
          id: m.id,
          title: m.moduleId,
          subtitle: `v${m.version} · ${m.status}`,
          href: `/modules/${encodeURIComponent(m.moduleId)}`,
        });
      }

      // Rank: exact slug/code matches first, then prefix matches, then
      // contains. Stable enough for a UX shortcut.
      const score = (item: { title: string; subtitle?: string }): number => {
        const t = item.title.toLowerCase();
        if (t === qLower) return 0;
        if (t.startsWith(qLower)) return 1;
        if (item.subtitle?.toLowerCase().includes(qLower)) return 2;
        return 3;
      };
      matches.sort((a, b) => score(a) - score(b));
      const trimmed = matches.slice(0, limit);

      return {
        data: trimmed,
        meta: { query: q, totalReturned: trimmed.length },
      };
    },
  );
}
