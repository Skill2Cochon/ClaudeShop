export type { ProductRepository } from './product-repository';
export type {
  VariantRepository,
  VariantSummary,
  UpsertPriceSetInput,
} from './variant-repository';
export type { CartRepository } from './cart-repository';
export type { OrderRepository, ListOrdersOptions } from './order-repository';
export type {
  OrderNoteRepository,
  AppendOrderNoteInput,
  ListOrderNotesOptions,
} from './order-note-repository';
export type {
  CustomerNoteRepository,
  AppendCustomerNoteInput,
  ListCustomerNotesOptions,
} from './customer-note-repository';
export type { CustomerAddressRepository } from './customer-address-repository';
export type {
  CustomerRepository,
  SegmentMember,
  ListCustomersOptions,
} from './customer-repository';
export type {
  InventoryRepository,
  StockReservation,
  InventoryProjection,
  InventoryListOptions,
  InventorySummary,
  AdjustStockInput,
  SetSafetyStockInput,
} from './inventory-repository';
export type {
  AuditLogRepository,
  AuditLogEntry,
  AppendAuditLogInput,
  AuditActorType,
  ListAuditLogsOptions,
} from './audit-log-repository';
export type { IdempotencyStore, IdempotencyRecord } from './idempotency-store';
export type {
  PaymentProvider,
  PaymentProviderEvent,
  CreateIntentInput,
  CreateIntentResult,
  RefundInput,
  RefundResult,
} from './payment-provider';
export type { PaymentRepository, CreatePaymentInput } from './payment-repository';
export type { WebhookEventRepository } from './webhook-event-repository';
export type {
  ModuleInstallationRepository,
  ModuleInstallation,
  ModuleStatus,
} from './module-installation-repository';
export type { Clock } from './clock';
export { SystemClock } from './clock';
export type {
  AIProvider,
  GenerateProductCopyInput,
  LocalizedProductCopy,
  ProductCopyResult,
} from './ai-provider';
export type {
  EmbeddingProvider,
  EmbedOneInput,
  EmbedManyInput,
  EmbeddingResult,
  BatchEmbeddingResult,
} from './embedding-provider';
export type {
  SearchRepository,
  UpsertProductEmbeddingInput,
  ProductSearchHit,
} from './search-repository';
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
} from './chat-provider';
export type {
  AuthUserRepository,
  AuthUserWithHash,
  CreateAuthUserInput,
} from './auth-user-repository';
export type { PasswordHasher } from './password-hasher';
export type { PageRepository } from './page-repository';
export type { PromotionRepository } from './promotion-repository';
export type { SupplierRepository } from './supplier-repository';
export type {
  PurchaseOrderRepository,
  ReceivePurchaseOrderLinePatch,
} from './purchase-order-repository';
export type {
  AnalyticsRepository,
  InventoryHealth,
  OrderStatusBreakdown,
  RevenueSummary,
  RevenueWindow,
  TopProductRow,
} from './analytics-repository';
export type { TaxRateRepository } from './tax-rate-repository';
export type { ShippingRateRepository } from './shipping-rate-repository';
export type { CustomerSegmentRepository } from './customer-segment-repository';
export type { EmailCampaignRepository } from './email-campaign-repository';
export type {
  EmailMessage,
  EmailProvider,
  EmailRecipient,
  EmailSendOutcome,
  EmailSendResult,
} from './email-provider';
export type { WebhookSubscriptionRepository } from './webhook-subscription-repository';
export type {
  WebhookDeliveryRepository,
  CreateWebhookDeliveryInput,
  RecordAttemptInput,
} from './webhook-delivery-repository';
export type { HttpClient, HttpRequest, HttpResponse } from './http-client';
export type { CategoryRepository } from './category-repository';
export type { ReviewRepository } from './review-repository';
export type { TenantSettingsRepository } from './tenant-settings-repository';
export type {
  WishlistRepository,
  WishlistEntry,
} from './wishlist-repository';
export type {
  ApiKeyRepository,
  ApiKeyRow,
  ApiKeyVerified,
  CreateApiKeyInput,
} from './api-key-repository';
