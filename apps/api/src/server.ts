import { createPrismaClient } from '@claudeshop/db';
import { createLogger } from '@claudeshop/telemetry';
import { buildApp } from './app';
import { loadEnv } from './config/env';
import { PrismaProductRepository } from './adapters/prisma-product-repository';
import { PrismaCartRepository } from './adapters/prisma-cart-repository';
import { PrismaVariantRepository } from './adapters/prisma-variant-repository';
import { PrismaOrderRepository } from './adapters/prisma-order-repository';
import { PrismaOrderNoteRepository } from './adapters/prisma-order-note-repository';
import { PrismaInventoryRepository } from './adapters/prisma-inventory-repository';
import { PrismaIdempotencyStore } from './adapters/prisma-idempotency-store';
import { PrismaWebhookEventRepository } from './adapters/prisma-webhook-event-repository';
import { PrismaPaymentRepository } from './adapters/prisma-payment-repository';
import { PrismaModuleInstallationRepository } from './adapters/prisma-module-installation-repository';
import { PrismaSearchRepository } from './adapters/prisma-search-repository';
import { PrismaAuthUserRepository } from './adapters/prisma-auth-user-repository';
import { PrismaAuditLogRepository } from './adapters/prisma-audit-log-repository';
import { PrismaTenantSettingsRepository } from './adapters/prisma-tenant-settings-repository';
import { PrismaWishlistRepository } from './adapters/prisma-wishlist-repository';
import { PrismaApiKeyRepository } from './adapters/prisma-api-key-repository';
import { BcryptPasswordHasher } from './adapters/bcrypt-password-hasher';
import { PrismaPageRepository } from './adapters/prisma-page-repository';
import { PrismaPromotionRepository } from './adapters/prisma-promotion-repository';
import { PrismaSupplierRepository } from './adapters/prisma-supplier-repository';
import { PrismaPurchaseOrderRepository } from './adapters/prisma-purchase-order-repository';
import { PrismaAnalyticsRepository } from './adapters/prisma-analytics-repository';
import { PrismaTaxRateRepository } from './adapters/prisma-tax-rate-repository';
import { PrismaShippingRateRepository } from './adapters/prisma-shipping-rate-repository';
import { PrismaCustomerRepository } from './adapters/prisma-customer-repository';
import { PrismaCustomerNoteRepository } from './adapters/prisma-customer-note-repository';
import { PrismaCustomerAddressRepository } from './adapters/prisma-customer-address-repository';
import { PrismaCustomerSegmentRepository } from './adapters/prisma-customer-segment-repository';
import { PrismaEmailCampaignRepository } from './adapters/prisma-email-campaign-repository';
import { PrismaWebhookSubscriptionRepository } from './adapters/prisma-webhook-subscription-repository';
import { PrismaWebhookDeliveryRepository } from './adapters/prisma-webhook-delivery-repository';
import { FetchHttpClient } from './adapters/fetch-http-client';
import { PrismaCategoryRepository } from './adapters/prisma-category-repository';
import { PrismaReviewRepository } from './adapters/prisma-review-repository';
import { StubEmailProvider } from '@claudeshop/core';
import { resolvePaymentProvider } from './modules/payment-provider-loader';
import { ModuleRegistry } from './modules/registry';
import { resolveAIProvider } from './adapters/ai-provider-loader';
import { resolveEmbeddingProvider } from './adapters/embedding-provider-loader';
import { resolveChatProvider } from './adapters/chat-provider-loader';

async function start() {
  const env = loadEnv();
  const bootLogger = createLogger({ level: env.LOG_LEVEL, name: 'claudeshop-api-boot' });

  const prisma = createPrismaClient({ datasourceUrl: env.DATABASE_URL });
  const productRepository = new PrismaProductRepository(prisma);
  const cartRepository = new PrismaCartRepository(prisma);
  const variantRepository = new PrismaVariantRepository(prisma);
  const orderRepository = new PrismaOrderRepository(prisma);
  const orderNoteRepository = new PrismaOrderNoteRepository(prisma);
  const inventoryRepository = new PrismaInventoryRepository(prisma);
  const paymentRepository = new PrismaPaymentRepository(prisma);
  const moduleInstallationRepository = new PrismaModuleInstallationRepository(prisma);
  const searchRepository = new PrismaSearchRepository(prisma);
  const authUserRepository = new PrismaAuthUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const auditLogRepository = new PrismaAuditLogRepository(prisma);
  const tenantSettingsRepository = new PrismaTenantSettingsRepository(prisma);
  const wishlistRepository = new PrismaWishlistRepository(prisma);
  const apiKeyRepository = new PrismaApiKeyRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  const promotionRepository = new PrismaPromotionRepository(prisma);
  const supplierRepository = new PrismaSupplierRepository(prisma);
  const purchaseOrderRepository = new PrismaPurchaseOrderRepository(prisma);
  const analyticsRepository = new PrismaAnalyticsRepository(prisma);
  const taxRateRepository = new PrismaTaxRateRepository(prisma);
  const shippingRateRepository = new PrismaShippingRateRepository(prisma);
  const customerRepository = new PrismaCustomerRepository(prisma);
  const customerNoteRepository = new PrismaCustomerNoteRepository(prisma);
  const customerAddressRepository = new PrismaCustomerAddressRepository(prisma);
  const customerSegmentRepository = new PrismaCustomerSegmentRepository(prisma);
  const emailCampaignRepository = new PrismaEmailCampaignRepository(prisma);
  const emailProvider = new StubEmailProvider();
  const webhookSubscriptionRepository = new PrismaWebhookSubscriptionRepository(prisma);
  const webhookDeliveryRepository = new PrismaWebhookDeliveryRepository(prisma);
  const webhookHttp = new FetchHttpClient();
  const categoryRepository = new PrismaCategoryRepository(prisma);
  const reviewRepository = new PrismaReviewRepository(prisma);
  const idempotencyStore = new PrismaIdempotencyStore(prisma);
  const webhookEventRepository = new PrismaWebhookEventRepository(prisma);

  // Phase 3.0 fallback — single-tenant env-driven provider. Phase 3.1 layers
  // the ModuleRegistry on top for per-tenant installations from DB.
  const fallbackPaymentProvider = await resolvePaymentProvider(env);

  const moduleRegistry = new ModuleRegistry({
    installationRepo: moduleInstallationRepository,
    fallbackPaymentProvider,
    logger: bootLogger,
  });
  await moduleRegistry.init();

  const aiProvider = resolveAIProvider(env);
  bootLogger.info({ aiProvider: aiProvider.name, model: env.ANTHROPIC_MODEL }, 'AI provider ready');

  const embeddingProvider = resolveEmbeddingProvider(env);
  bootLogger.info(
    {
      embeddingProvider: embeddingProvider.name,
      model: env.VOYAGE_MODEL,
      dimensions: embeddingProvider.dimensions,
    },
    'Embedding provider ready',
  );

  const chatProvider = resolveChatProvider(env);
  bootLogger.info(
    { chatProvider: chatProvider.name, model: env.ANTHROPIC_MODEL },
    'Copilot chat provider ready',
  );

  // Phase 60 — slug → tenant-id resolver with a small LRU cache.
  // Used by the preHandler hook in buildApp(). 60-second TTL keeps
  // stale cache harmless even if a tenant rename happens mid-session.
  const slugCache = new Map<string, { id: string; expiresAt: number }>();
  const SLUG_CACHE_TTL_MS = 60_000;
  const SLUG_CACHE_MAX = 200;
  const resolveTenantIdFromSlug = async (slug: string): Promise<string | null> => {
    const now = Date.now();
    const cached = slugCache.get(slug);
    if (cached && cached.expiresAt > now) {
      return cached.id;
    }
    const row = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!row) return null;
    // Cheap LRU: evict oldest if full.
    if (slugCache.size >= SLUG_CACHE_MAX) {
      const oldest = slugCache.keys().next().value;
      if (oldest !== undefined) slugCache.delete(oldest);
    }
    slugCache.set(slug, { id: row.id, expiresAt: now + SLUG_CACHE_TTL_MS });
    return row.id;
  };

  const app = await buildApp({
    env,
    resolveTenantIdFromSlug,
    productRepository,
    cartRepository,
    variantRepository,
    orderRepository,
    orderNoteRepository,
    inventoryRepository,
    paymentProvider: fallbackPaymentProvider,
    paymentRepository,
    moduleInstallationRepository,
    moduleRegistry,
    aiProvider,
    embeddingProvider,
    searchRepository,
    chatProvider,
    authUserRepository,
    passwordHasher,
    auditLogRepository,
    tenantSettingsRepository,
    wishlistRepository,
    apiKeyRepository,
    pageRepository,
    promotionRepository,
    supplierRepository,
    purchaseOrderRepository,
    analyticsRepository,
    taxRateRepository,
    shippingRateRepository,
    customerRepository,
    customerNoteRepository,
    customerAddressRepository,
    customerSegmentRepository,
    emailCampaignRepository,
    emailProvider,
    emailFromAddress: env.EMAIL_FROM_ADDRESS,
    webhookSubscriptionRepository,
    webhookDeliveryRepository,
    webhookHttp,
    categoryRepository,
    reviewRepository,
    idempotencyStore,
    webhookEventRepository,
  });

  const closeOnSignal = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down gracefully');
    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void closeOnSignal('SIGINT'));
  process.on('SIGTERM', () => void closeOnSignal('SIGTERM'));

  process.on('unhandledRejection', (err) => {
    app.log.error({ err }, 'Unhandled rejection');
  });

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (err) {
    app.log.error({ err }, 'Failed to start API');
    process.exit(1);
  }
}

void start();
