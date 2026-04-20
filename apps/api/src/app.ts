import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import underPressure from '@fastify/under-pressure';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { toApiError } from '@claudeshop/errors';
import type {
  AIProvider,
  AuditLogRepository,
  AuthUserRepository,
  CartRepository,
  TenantSettingsRepository,
  WishlistRepository,
  ApiKeyRepository,
  ChatProvider,
  EmbeddingProvider,
  IdempotencyStore,
  InventoryRepository,
  OrderRepository,
  OrderNoteRepository,
  AnalyticsRepository,
  CategoryRepository,
  CustomerRepository,
  CustomerNoteRepository,
  CustomerAddressRepository,
  CustomerSegmentRepository,
  ReviewRepository,
  EmailCampaignRepository,
  EmailProvider,
  HttpClient,
  PageRepository,
  PasswordHasher,
  PromotionRepository,
  PurchaseOrderRepository,
  ShippingRateRepository,
  SupplierRepository,
  TaxRateRepository,
  WebhookDeliveryRepository as OutboundWebhookDeliveryRepository,
  WebhookSubscriptionRepository,
  PaymentProvider,
  PaymentRepository,
  ProductRepository,
  SearchRepository,
  VariantRepository,
  WebhookEventRepository,
} from '@claudeshop/core';
import { InMemoryIdempotencyStore, InMemoryWebhookEventRepository } from '@claudeshop/core';
import { registerHealthRoutes } from './routes/health';
import { registerProductRoutes } from './routes/products';
import { registerCartRoutes } from './routes/cart';
import { registerOrderRoutes } from './routes/orders';
import { registerPaymentRoutes } from './routes/payments';
import { registerWebhookRoutes } from './routes/webhooks';
import { registerAdminModuleRoutes } from './routes/admin-modules';
import { registerAdminProductRoutes } from './routes/admin-products';
import { registerSearchRoutes } from './routes/search';
import { registerAdminCopilotRoutes } from './routes/admin-copilot';
import { registerAuthRoutes } from './routes/auth';
import { registerPageRoutes } from './routes/pages';
import { registerPromotionRoutes } from './routes/promotions';
import { registerSupplierRoutes } from './routes/suppliers';
import { registerPurchaseOrderRoutes } from './routes/purchase-orders';
import { registerAnalyticsRoutes } from './routes/analytics';
import { registerTaxRateRoutes } from './routes/tax-rates';
import { registerShippingRateRoutes } from './routes/shipping-rates';
import { registerSegmentRoutes } from './routes/segments';
import { registerCampaignRoutes } from './routes/campaigns';
import { registerWebhookSubscriptionRoutes } from './routes/webhook-subscriptions';
import { registerCategoryRoutes } from './routes/categories';
import { registerReviewRoutes } from './routes/reviews';
import { registerAdminSearchRoutes } from './routes/admin-search';
import { registerAdminInventoryRoutes } from './routes/admin-inventory';
import { registerAdminProductImportRoutes } from './routes/admin-product-import';
import { registerAdminAuditLogRoutes } from './routes/admin-audit-log';
import { registerAdminSettingsRoutes } from './routes/admin-settings';
import { registerAdminVariantPricingRoutes } from './routes/admin-variant-pricing';
import { registerAdminOrderRoutes } from './routes/admin-orders';
import { registerAdminApiKeyRoutes } from './routes/admin-api-keys';
import { registerAdminCustomerRoutes } from './routes/admin-customers';
import { registerAdminOrdersExportRoutes } from './routes/admin-orders-export';
import { registerAdminCustomersExportRoutes } from './routes/admin-customers-export';
import { registerAdminProductsExportRoutes } from './routes/admin-products-export';
import { registerAdminOrderNoteRoutes } from './routes/admin-order-notes';
import { registerAdminCustomerNoteRoutes } from './routes/admin-customer-notes';
import { registerAccountAddressRoutes } from './routes/account-addresses';
import { registerAdminAuditLogExportRoutes } from './routes/admin-audit-log-export';
import { registerAdminInventoryExportRoutes } from './routes/admin-inventory-export';
import { registerAdminWebhookDeliveriesExportRoutes } from './routes/admin-webhook-deliveries-export';
import { registerAdminInventoryDigestRoutes } from './routes/admin-inventory-digest';
import { registerAdminPagesExportRoutes } from './routes/admin-pages-export';
import { apiKeyPlugin } from './plugins/api-key';
import { registerPublicSiteSettingsRoutes } from './routes/public-site-settings';
import { registerPublicOrderTrackingRoutes } from './routes/public-order-tracking';
import { registerPublicNewsletterRoutes } from './routes/public-newsletter';
import { registerWishlistRoutes } from './routes/wishlist';
import { idempotencyPlugin } from './plugins/idempotency';
import { rawBodyPlugin } from './plugins/raw-body';
import type { ModuleRegistry } from './modules/registry';
import type { ModuleInstallationRepository } from '@claudeshop/core';
import type { Env } from './config/env';

export interface BuildAppOptions {
  env: Env;
  productRepository: ProductRepository;
  cartRepository: CartRepository;
  variantRepository: VariantRepository;
  orderRepository: OrderRepository;
  orderNoteRepository: OrderNoteRepository;
  inventoryRepository: InventoryRepository;
  paymentProvider: PaymentProvider;
  paymentRepository: PaymentRepository;
  moduleInstallationRepository: ModuleInstallationRepository;
  moduleRegistry: ModuleRegistry;
  aiProvider: AIProvider;
  embeddingProvider: EmbeddingProvider;
  searchRepository: SearchRepository;
  chatProvider: ChatProvider;
  authUserRepository: AuthUserRepository;
  passwordHasher: PasswordHasher;
  auditLogRepository: AuditLogRepository;
  tenantSettingsRepository: TenantSettingsRepository;
  wishlistRepository: WishlistRepository;
  apiKeyRepository: ApiKeyRepository;
  pageRepository: PageRepository;
  promotionRepository: PromotionRepository;
  supplierRepository: SupplierRepository;
  purchaseOrderRepository: PurchaseOrderRepository;
  analyticsRepository: AnalyticsRepository;
  taxRateRepository: TaxRateRepository;
  shippingRateRepository: ShippingRateRepository;
  customerRepository: CustomerRepository;
  customerNoteRepository: CustomerNoteRepository;
  customerAddressRepository: CustomerAddressRepository;
  customerSegmentRepository: CustomerSegmentRepository;
  emailCampaignRepository: EmailCampaignRepository;
  emailProvider: EmailProvider;
  emailFromAddress: string;
  webhookSubscriptionRepository: WebhookSubscriptionRepository;
  webhookDeliveryRepository: OutboundWebhookDeliveryRepository;
  webhookHttp: HttpClient;
  categoryRepository: CategoryRepository;
  reviewRepository: ReviewRepository;
  /** Optional — defaults to InMemoryIdempotencyStore. Use Prisma store in prod. */
  idempotencyStore?: IdempotencyStore;
  /** Optional — defaults to InMemoryWebhookEventRepository. Use Prisma in prod. */
  webhookEventRepository?: WebhookEventRepository;
  /**
   * Phase 1 stub: resolve tenantId from an `x-tenant-id` header.
   * Phase 2+ replaces this with subdomain + auth session resolution.
   */
  resolveTenantId?: (request: { headers: Record<string, unknown> }) => string;
  /**
   * Optional async slug → tenant-id resolver. When a request arrives
   * with only `x-tenant-slug` (no `x-tenant-id`), a preHandler hook
   * calls this function and writes the resolved id onto the request
   * headers so the sync resolveTenantId downstream still works unchanged.
   *
   * Wired in server.ts to a Prisma lookup with an LRU cache (60s TTL),
   * so repeated requests for the same slug incur zero DB cost after the
   * first hit. Exists so a fresh-install storefront/admin can address
   * the demo tenant by its stable slug without hardcoding the seed's
   * generated CUID into every env file.
   */
  resolveTenantIdFromSlug?: (slug: string) => Promise<string | null>;
  /** Phase 2 stub: resolve currency per tenant (defaults to EUR). */
  resolveCurrency?: (request: { headers: Record<string, unknown> }) => string;
  /** Order number prefix per deployment (defaults to "CS"). */
  orderNumberPrefix?: string;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = opts;

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV !== 'production'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
      redact: {
        paths: [
          '*.password',
          '*.token',
          '*.secret',
          '*.apiKey',
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
        ],
        remove: true,
      },
    },
    trustProxy: true,
    disableRequestLogging: false,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // --- Security / platform plugins -----------------------------------------
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });

  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : /\.claudeshop\.(dev|io|local)$/,
    credentials: true,
  });

  await app.register(sensible);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'];
      if (typeof apiKey === 'string') return `apikey:${apiKey}`;
      return `ip:${req.ip}`;
    },
  });

  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1_000_000_000, // 1 GB
    maxRssBytes: 1_500_000_000, // 1.5 GB
    maxEventLoopUtilization: 0.98,
    exposeStatusRoute: false,
  });

  // --- Error envelope ------------------------------------------------------
  app.setErrorHandler((err, req, reply) => {
    const envelope = toApiError(err, req.id);
    const status = envelope.error.status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    if (status >= 500) {
      req.log.error({ err }, 'Unhandled error');
    } else {
      req.log.warn({ err: { message, code: envelope.error.code } }, 'Request error');
    }
    return reply.status(status).send(envelope);
  });

  // --- Routes --------------------------------------------------------------
  // Tenant resolution: Phase 33's apiKeyPlugin promotes
  // `request.apiKey.tenantId` into the `x-tenant-id` header during the
  // preHandler hook, so API-key clients don't need to also send
  // `x-tenant-id` explicitly. Callers with a session cookie pass
  // the header on every request as before.
  //
  // Phase 60: a second preHandler (below) also accepts `x-tenant-slug`
  // and rewrites it into `x-tenant-id` via an async Prisma lookup,
  // so fresh installs can hit the demo tenant without hardcoding
  // the seed-generated CUID into every env file.
  const resolveTenantId =
    opts.resolveTenantId ??
    ((req) => {
      const header = req.headers['x-tenant-id'];
      if (typeof header !== 'string' || header.length < 8) {
        throw new Error(
          'Missing tenant resolution. Provide an x-api-key / Bearer token, ' +
            'an x-tenant-id header, or an x-tenant-slug header.',
        );
      }
      return header;
    });

  // Phase 60 — slug → id promotion preHandler.
  //
  // Fires before any route handler. Only does work when:
  //   - `x-tenant-id` is missing or too short to be a valid id, AND
  //   - `x-tenant-slug` is present, AND
  //   - a `resolveTenantIdFromSlug` is configured (server.ts wires it).
  //
  // On success, writes the resolved id back into `x-tenant-id` so the
  // sync resolveTenantId call sites downstream read it unchanged. On
  // failure, leaves the request untouched so the sync resolver surfaces
  // its own error envelope (no silent 500s).
  if (opts.resolveTenantIdFromSlug) {
    const resolveSlug = opts.resolveTenantIdFromSlug;
    app.addHook('preHandler', async (req) => {
      const existingId = req.headers['x-tenant-id'];
      if (typeof existingId === 'string' && existingId.length >= 8) {
        return;
      }
      const slugHeader = req.headers['x-tenant-slug'];
      if (typeof slugHeader !== 'string' || slugHeader.length === 0) {
        return;
      }
      // Keep slug format strict — only a-z0-9- / max 80 chars — so we
      // can't be tricked into looking up weird strings.
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slugHeader)) {
        return;
      }
      try {
        const id = await resolveSlug(slugHeader);
        if (id && id.length >= 8) {
          (req.headers as Record<string, unknown>)['x-tenant-id'] = id;
        }
      } catch (err) {
        req.log.warn({ err, slug: slugHeader }, 'Tenant slug lookup failed');
        // Fall through — the sync resolver below will emit its own error.
      }
    });
  }

  // Raw body capture for webhook signature verification (Phase 2.6).
  await app.register(rawBodyPlugin, {
    routes: new Set(['POST /v1/webhooks/payment']),
  });

  // Phase 33: resolve x-api-key / Bearer tokens into request.apiKey on every
  // request. Plugin is permissive — routes remain open unless they opt into
  // the authenticated branch. Downstream tenant resolvers prefer request.apiKey
  // when present.
  await app.register(apiKeyPlugin, {
    repo: opts.apiKeyRepository,
    hasher: opts.passwordHasher,
  });

  // --- Idempotency plugin --------------------------------------------------
  const idempotencyStore: IdempotencyStore =
    opts.idempotencyStore ?? new InMemoryIdempotencyStore();
  await app.register(idempotencyPlugin, {
    store: idempotencyStore,
    routes: new Set([
      'POST /v1/orders',
      'POST /v1/orders/:id/pay',
      'POST /v1/orders/:id/refund',
    ]),
    resolveTenantId: (req) =>
      resolveTenantId({ headers: req.headers as Record<string, unknown> }),
  });

  const webhookEventRepository: WebhookEventRepository =
    opts.webhookEventRepository ?? new InMemoryWebhookEventRepository();

  await app.register(registerHealthRoutes);
  await app.register(async (instance) => {
    await registerProductRoutes(instance, {
      repo: opts.productRepository,
      variantRepo: opts.variantRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerCategoryRoutes(instance, {
      repo: opts.categoryRepository,
      variantRepo: opts.variantRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerReviewRoutes(instance, {
      repo: opts.reviewRepository,
      productRepo: opts.productRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminSearchRoutes(instance, {
      productRepo: opts.productRepository,
      orderRepo: opts.orderRepository,
      customerRepo: opts.customerRepository,
      segmentRepo: opts.customerSegmentRepository,
      campaignRepo: opts.emailCampaignRepository,
      supplierRepo: opts.supplierRepository,
      pageRepo: opts.pageRepository,
      promotionRepo: opts.promotionRepository,
      moduleRepo: opts.moduleInstallationRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminInventoryRoutes(instance, {
      inventoryRepo: opts.inventoryRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminProductImportRoutes(instance, {
      productRepo: opts.productRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminAuditLogRoutes(instance, {
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminSettingsRoutes(instance, {
      settingsRepo: opts.tenantSettingsRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminVariantPricingRoutes(instance, {
      variantRepo: opts.variantRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminOrderRoutes(instance, {
      orderRepo: opts.orderRepository,
      inventoryRepo: opts.inventoryRepository,
      auditLogRepo: opts.auditLogRepository,
      orderNoteRepo: opts.orderNoteRepository,
      email: opts.emailProvider,
      settingsRepo: opts.tenantSettingsRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminApiKeyRoutes(instance, {
      apiKeyRepo: opts.apiKeyRepository,
      hasher: opts.passwordHasher,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminCustomerRoutes(instance, {
      customerRepo: opts.customerRepository,
      orderRepo: opts.orderRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminOrdersExportRoutes(instance, {
      orderRepo: opts.orderRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminCustomersExportRoutes(instance, {
      customerRepo: opts.customerRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminProductsExportRoutes(instance, {
      productRepo: opts.productRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminOrderNoteRoutes(instance, {
      orderNoteRepo: opts.orderNoteRepository,
      orderRepo: opts.orderRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminCustomerNoteRoutes(instance, {
      customerNoteRepo: opts.customerNoteRepository,
      customerRepo: opts.customerRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAccountAddressRoutes(instance, {
      addressRepo: opts.customerAddressRepository,
      customerRepo: opts.customerRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminAuditLogExportRoutes(instance, {
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminInventoryExportRoutes(instance, {
      inventoryRepo: opts.inventoryRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminInventoryDigestRoutes(instance, {
      inventoryRepo: opts.inventoryRepository,
      settingsRepo: opts.tenantSettingsRepository,
      email: opts.emailProvider,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminPagesExportRoutes(instance, {
      pageRepo: opts.pageRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminWebhookDeliveriesExportRoutes(instance, {
      deliveryRepo: opts.webhookDeliveryRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPublicSiteSettingsRoutes(instance, {
      settingsRepo: opts.tenantSettingsRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPublicOrderTrackingRoutes(instance, {
      orderRepo: opts.orderRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPublicNewsletterRoutes(instance, {
      customerRepo: opts.customerRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerWishlistRoutes(instance, {
      wishlistRepo: opts.wishlistRepository,
      productRepo: opts.productRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerCartRoutes(instance, {
      cartRepo: opts.cartRepository,
      variantRepo: opts.variantRepository,
      resolveTenantId,
      ...(opts.resolveCurrency ? { resolveCurrency: opts.resolveCurrency } : {}),
    });
  });
  await app.register(async (instance) => {
    await registerOrderRoutes(instance, {
      cartRepo: opts.cartRepository,
      orderRepo: opts.orderRepository,
      variantRepo: opts.variantRepository,
      inventoryRepo: opts.inventoryRepository,
      taxRateRepo: opts.taxRateRepository,
      shippingRateRepo: opts.shippingRateRepository,
      webhookSubscriptionRepo: opts.webhookSubscriptionRepository,
      webhookDeliveryRepo: opts.webhookDeliveryRepository,
      webhookHttp: opts.webhookHttp,
      emailProvider: opts.emailProvider,
      tenantSettingsRepo: opts.tenantSettingsRepository,
      orderNoteRepo: opts.orderNoteRepository,
      promotionRepo: opts.promotionRepository,
      resolveTenantId,
      ...(opts.orderNumberPrefix ? { numberPrefix: opts.orderNumberPrefix } : {}),
    });
  });
  await app.register(async (instance) => {
    await registerPaymentRoutes(instance, {
      orderRepo: opts.orderRepository,
      paymentProvider: opts.paymentProvider,
      paymentRepo: opts.paymentRepository,
      inventoryRepo: opts.inventoryRepository,
      emailProvider: opts.emailProvider,
      tenantSettingsRepo: opts.tenantSettingsRepository,
      orderNoteRepo: opts.orderNoteRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerWebhookRoutes(instance, {
      paymentProvider: opts.paymentProvider,
      orderRepo: opts.orderRepository,
      paymentRepo: opts.paymentRepository,
      webhookEventRepo: webhookEventRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminModuleRoutes(instance, {
      registry: opts.moduleRegistry,
      installationRepo: opts.moduleInstallationRepository,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminProductRoutes(instance, {
      productRepo: opts.productRepository,
      ai: opts.aiProvider,
      embedder: opts.embeddingProvider,
      searchRepo: opts.searchRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerSearchRoutes(instance, {
      productRepo: opts.productRepository,
      searchRepo: opts.searchRepository,
      embedder: opts.embeddingProvider,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAuthRoutes(instance, {
      authUserRepo: opts.authUserRepository,
      hasher: opts.passwordHasher,
      auditLogRepo: opts.auditLogRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPageRoutes(instance, {
      repo: opts.pageRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPromotionRoutes(instance, {
      repo: opts.promotionRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerSupplierRoutes(instance, {
      repo: opts.supplierRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAnalyticsRoutes(instance, {
      repo: opts.analyticsRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerTaxRateRoutes(instance, {
      repo: opts.taxRateRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerShippingRateRoutes(instance, {
      repo: opts.shippingRateRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerSegmentRoutes(instance, {
      repo: opts.customerSegmentRepository,
      customerRepo: opts.customerRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerCampaignRoutes(instance, {
      repo: opts.emailCampaignRepository,
      segmentRepo: opts.customerSegmentRepository,
      customerRepo: opts.customerRepository,
      email: opts.emailProvider,
      fromAddress: opts.emailFromAddress,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerWebhookSubscriptionRoutes(instance, {
      subscriptionRepo: opts.webhookSubscriptionRepository,
      deliveryRepo: opts.webhookDeliveryRepository,
      http: opts.webhookHttp,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerPurchaseOrderRoutes(instance, {
      repo: opts.purchaseOrderRepository,
      supplierRepo: opts.supplierRepository,
      inventoryRepo: opts.inventoryRepository,
      resolveTenantId,
    });
  });
  await app.register(async (instance) => {
    await registerAdminCopilotRoutes(instance, {
      chatProvider: opts.chatProvider,
      productRepo: opts.productRepository,
      orderRepo: opts.orderRepository,
      moduleRepo: opts.moduleInstallationRepository,
      searchRepo: opts.searchRepository,
      embedder: opts.embeddingProvider,
      ai: opts.aiProvider,
      analytics: opts.analyticsRepository,
      resolveTenantId,
    });
  });

  app.get('/', async () => ({
    data: {
      service: 'claudeshop-api',
      version: process.env.npm_package_version ?? '0.1.0',
      env: env.NODE_ENV,
      docs: `${env.API_PUBLIC_URL}/docs`,
    },
  }));

  await app.ready();
  return app;
}
