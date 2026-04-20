export type { ProductRepository } from './product-repository.js';
export type {
  VariantRepository,
  VariantSummary,
  UpsertPriceSetInput,
} from './variant-repository.js';
export type { CartRepository } from './cart-repository.js';
export type { OrderRepository, ListOrdersOptions } from './order-repository.js';
export type {
  OrderNoteRepository,
  AppendOrderNoteInput,
  ListOrderNotesOptions,
} from './order-note-repository.js';
export type {
  CustomerNoteRepository,
  AppendCustomerNoteInput,
  ListCustomerNotesOptions,
} from './customer-note-repository.js';
export type { CustomerAddressRepository } from './customer-address-repository.js';
export type {
  CustomerRepository,
  SegmentMember,
  ListCustomersOptions,
} from './customer-repository.js';
export type {
  InventoryRepository,
  StockReservation,
  InventoryProjection,
  InventoryListOptions,
  InventorySummary,
  AdjustStockInput,
  SetSafetyStockInput,
} from './inventory-repository.js';
export type {
  AuditLogRepository,
  AuditLogEntry,
  AppendAuditLogInput,
  AuditActorType,
  ListAuditLogsOptions,
} from './audit-log-repository.js';
export type { IdempotencyStore, IdempotencyRecord } from './idempotency-store.js';
export type {
  PaymentProvider,
  PaymentProviderEvent,
  CreateIntentInput,
  CreateIntentResult,
  RefundInput,
  RefundResult,
} from './payment-provider.js';
export type { PaymentRepository, CreatePaymentInput } from './payment-repository.js';
export type { WebhookEventRepository } from './webhook-event-repository.js';
export type {
  ModuleInstallationRepository,
  ModuleInstallation,
  ModuleStatus,
} from './module-installation-repository.js';
export type { Clock } from './clock.js';
export { SystemClock } from './clock.js';
export type {
  AIProvider,
  GenerateProductCopyInput,
  LocalizedProductCopy,
  ProductCopyResult,
} from './ai-provider.js';
export type {
  EmbeddingProvider,
  EmbedOneInput,
  EmbedManyInput,
  EmbeddingResult,
  BatchEmbeddingResult,
} from './embedding-provider.js';
export type {
  SearchRepository,
  UpsertProductEmbeddingInput,
  ProductSearchHit,
} from './search-repository.js';
export type {
  ChatProvider,
  ChatInput,
  ChatMessage,
  ChatMessageRole,
  ChatResult,
  ChatToolInvocation,
  ChatUsage,
  ToolDefinition,
  ToolInvoker,
} from './chat-provider.js';
export type {
  AuthUserRepository,
  AuthUserWithHash,
  CreateAuthUserInput,
} from './auth-user-repository.js';
export type { PasswordHasher } from './password-hasher.js';
export type { PageRepository } from './page-repository.js';
export type { PromotionRepository } from './promotion-repository.js';
export type { SupplierRepository } from './supplier-repository.js';
export type {
  PurchaseOrderRepository,
  ReceivePurchaseOrderLinePatch,
} from './purchase-order-repository.js';
export type {
  AnalyticsRepository,
  InventoryHealth,
  OrderStatusBreakdown,
  RevenueSummary,
  RevenueWindow,
  TopProductRow,
} from './analytics-repository.js';
export type { TaxRateRepository } from './tax-rate-repository.js';
export type { ShippingRateRepository } from './shipping-rate-repository.js';
export type { CustomerSegmentRepository } from './customer-segment-repository.js';
export type { EmailCampaignRepository } from './email-campaign-repository.js';
export type {
  EmailMessage,
  EmailProvider,
  EmailRecipient,
  EmailSendOutcome,
  EmailSendResult,
} from './email-provider.js';
export type { WebhookSubscriptionRepository } from './webhook-subscription-repository.js';
export type {
  WebhookDeliveryRepository,
  CreateWebhookDeliveryInput,
  RecordAttemptInput,
} from './webhook-delivery-repository.js';
export type { HttpClient, HttpRequest, HttpResponse } from './http-client.js';
export type { CategoryRepository } from './category-repository.js';
export type { ReviewRepository } from './review-repository.js';
export type { TenantSettingsRepository } from './tenant-settings-repository.js';
export type {
  WishlistRepository,
  WishlistEntry,
} from './wishlist-repository.js';
export type {
  ApiKeyRepository,
  ApiKeyRow,
  ApiKeyVerified,
  CreateApiKeyInput,
} from './api-key-repository.js';
