import type {
  Customer,
  CustomerGroup,
  CustomerNote,
} from '@claudeshop/contracts/customer';
import type {
  Order,
  OrderNote,
  OrderStatus,
} from '@claudeshop/contracts/order';
import type { Product } from '@claudeshop/contracts/product';
import type { Page, PageStatus } from '@claudeshop/contracts/page';
import type { Promotion, PromotionStatus } from '@claudeshop/contracts/promotion';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
} from '@claudeshop/contracts/erp';
import type { ShippingRate, TaxRate } from '@claudeshop/contracts/checkout';
import type {
  CustomerSegment,
  EmailCampaign,
  EmailCampaignStatus,
} from '@claudeshop/contracts/crm';
import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookSubscription,
} from '@claudeshop/contracts/webhook';
import type { Review, ReviewStatus } from '@claudeshop/contracts/review';
import { getCurrentSession } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Phase 60 — same fallback chain as apps/admin/src/lib/server-fetch.ts.
// See that file for the full rationale.
const FALLBACK_TENANT_ID =
  process.env.ADMIN_TENANT_ID ?? process.env.SEEDED_DEMO_TENANT_ID ?? '';
const FALLBACK_TENANT_SLUG =
  process.env.ADMIN_TENANT_SLUG ?? process.env.SEEDED_DEMO_TENANT_SLUG ?? 'demo';

interface ApiResponse<T> {
  data: T;
  meta?: { page?: number; limit?: number; total?: number };
}

interface ApiError {
  error: { code: string; message: string; status: number };
}

async function resolveTenantHeaders(): Promise<Record<string, string>> {
  const session = await getCurrentSession();
  const id = session?.tenantId ?? FALLBACK_TENANT_ID;
  if (id && id.length >= 8) {
    return { 'x-tenant-id': id };
  }
  return { 'x-tenant-slug': FALLBACK_TENANT_SLUG };
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T | null; meta: ApiResponse<unknown>['meta'] }> {
  const tenantHeaders = await resolveTenantHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (res.status === 404) return { data: null, meta: undefined };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    // Phase 60 — always include status + path so operators see the
    // real cause (the v0.1 `${body.error.message ?? 'Internal server error'}`
    // fallback hid 500s behind an unhelpful generic string).
    const serverMessage = body?.error?.message ?? body?.error?.code;
    const prefix = `API ${res.status} on ${path}`;
    throw new Error(serverMessage ? `${prefix}: ${serverMessage}` : prefix);
  }
  const body = (await res.json()) as ApiResponse<T>;
  return { data: body.data, meta: body.meta };
}

export async function listOrders(
  opts: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    customerId?: string;
    customerEmail?: string;
    numberQuery?: string;
    placedFrom?: string;
    placedTo?: string;
  } = {},
): Promise<{ items: Order[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  if (opts.customerId) params.set('customerId', opts.customerId);
  if (opts.customerEmail) params.set('customerEmail', opts.customerEmail);
  if (opts.numberQuery) params.set('numberQuery', opts.numberQuery);
  if (opts.placedFrom) params.set('placedFrom', opts.placedFrom);
  if (opts.placedTo) params.set('placedTo', opts.placedTo);
  const { data, meta } = await apiFetch<Order[]>(`/v1/orders?${params.toString()}`);
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data } = await apiFetch<Order>(`/v1/orders/${encodeURIComponent(id)}`);
  return data;
}

export interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  providerRef: string;
  status:
    | 'PENDING'
    | 'AUTHORIZED'
    | 'CAPTURED'
    | 'FAILED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED';
  amount: string;
  currency: string;
  idempotencyKey: string;
  capturedAt: string | null;
  createdAt: string;
}

export async function listOrderPayments(orderId: string): Promise<PaymentRow[]> {
  try {
    const { data } = await apiFetch<PaymentRow[]>(
      `/v1/orders/${encodeURIComponent(orderId)}/payments`,
    );
    return data ?? [];
  } catch {
    return [];
  }
}

// ----- Modules (Phase 3.1) -----

export interface ModuleInstallationRow {
  id: string;
  tenantId: string;
  moduleId: string;
  version: string;
  status: 'INSTALLED' | 'ACTIVE' | 'DISABLED' | 'FAILED';
  settings: Record<string, unknown>;
  lastError: string | null;
  installedAt: string;
  activatedAt: string | null;
  updatedAt: string;
}

export async function listInstalledModules(): Promise<ModuleInstallationRow[]> {
  try {
    const { data } = await apiFetch<ModuleInstallationRow[]>('/v1/admin/modules');
    return data ?? [];
  } catch {
    return [];
  }
}

export async function listProducts(
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: Product[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const { data, meta } = await apiFetch<Product[]>(
    `/v1/products?page=${page}&limit=${limit}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data } = await apiFetch<Product>(`/v1/products/${encodeURIComponent(id)}`);
  return data;
}

// ----- CMS pages (Phase 6) -----

export async function listPages(
  opts: { page?: number; limit?: number; status?: PageStatus } = {},
): Promise<{ items: Page[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  const { data, meta } = await apiFetch<Page[]>(
    `/v1/admin/pages?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getPageById(id: string): Promise<Page | null> {
  const { data } = await apiFetch<Page>(`/v1/admin/pages/${encodeURIComponent(id)}`);
  return data;
}

// ----- Promotions (Phase 7) -----

export async function listPromotions(
  opts: { page?: number; limit?: number; status?: PromotionStatus } = {},
): Promise<{ items: Promotion[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  const { data, meta } = await apiFetch<Promotion[]>(
    `/v1/admin/promotions?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  const { data } = await apiFetch<Promotion>(
    `/v1/admin/promotions/${encodeURIComponent(id)}`,
  );
  return data;
}

// ----- ERP: Suppliers + Purchase Orders (Phase 10) -----

export async function listSuppliers(
  opts: { page?: number; limit?: number; isActive?: boolean } = {},
): Promise<{ items: Supplier[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.isActive !== undefined) params.set('isActive', String(opts.isActive));
  const { data, meta } = await apiFetch<Supplier[]>(
    `/v1/admin/suppliers?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data } = await apiFetch<Supplier>(
    `/v1/admin/suppliers/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function listPurchaseOrders(
  opts: { page?: number; limit?: number; status?: PurchaseOrderStatus } = {},
): Promise<{ items: PurchaseOrder[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  const { data, meta } = await apiFetch<PurchaseOrder[]>(
    `/v1/admin/purchase-orders?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const { data } = await apiFetch<PurchaseOrder>(
    `/v1/admin/purchase-orders/${encodeURIComponent(id)}`,
  );
  return data;
}

// ----- Analytics (Phase 12) -----

export interface AnalyticsOverview {
  window: { days: number };
  revenue: {
    total: string;
    orderCount: number;
    currency: string;
    buckets: Array<{ date: string; revenue: string; orderCount: number }>;
  };
  topProducts: Array<{
    productId: string;
    sku: string;
    productName: string;
    qty: number;
    revenue: string;
  }>;
  inventory: {
    totalVariants: number;
    lowStockCount: number;
    outOfStockCount: number;
    overstockCount: number;
  };
  orderStatus: {
    counts: Record<string, number>;
    windowDays: number;
  };
}

export async function getAnalyticsOverview(
  opts: { days?: number; topLimit?: number } = {},
): Promise<AnalyticsOverview | null> {
  const params = new URLSearchParams();
  if (opts.days) params.set('days', String(opts.days));
  if (opts.topLimit) params.set('topLimit', String(opts.topLimit));
  const qs = params.toString();
  const { data } = await apiFetch<AnalyticsOverview>(
    `/v1/admin/analytics/overview${qs ? `?${qs}` : ''}`,
  );
  return data;
}

// ----- Tax + shipping rates (Phase 8) -----

export async function listTaxRates(
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: TaxRate[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const { data, meta } = await apiFetch<TaxRate[]>(
    `/v1/admin/tax-rates?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getTaxRate(id: string): Promise<TaxRate | null> {
  const { data } = await apiFetch<TaxRate>(
    `/v1/admin/tax-rates/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function listShippingRates(
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: ShippingRate[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const { data, meta } = await apiFetch<ShippingRate[]>(
    `/v1/admin/shipping-rates?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getShippingRate(id: string): Promise<ShippingRate | null> {
  const { data } = await apiFetch<ShippingRate>(
    `/v1/admin/shipping-rates/${encodeURIComponent(id)}`,
  );
  return data;
}

// ----- CRM (Phase 11) -----

export async function listSegments(
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: CustomerSegment[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const { data, meta } = await apiFetch<CustomerSegment[]>(
    `/v1/admin/segments?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getSegment(id: string): Promise<CustomerSegment | null> {
  const { data } = await apiFetch<CustomerSegment>(
    `/v1/admin/segments/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function listCampaigns(
  opts: { page?: number; limit?: number; status?: EmailCampaignStatus } = {},
): Promise<{ items: EmailCampaign[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  const { data, meta } = await apiFetch<EmailCampaign[]>(
    `/v1/admin/campaigns?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getCampaign(id: string): Promise<EmailCampaign | null> {
  const { data } = await apiFetch<EmailCampaign>(
    `/v1/admin/campaigns/${encodeURIComponent(id)}`,
  );
  return data;
}

// ----- Order notes (Phase 42) -----

export async function listOrderNotes(
  orderId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: OrderNote[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 100;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  try {
    const { data, meta } = await apiFetch<OrderNote[]>(
      `/v1/admin/orders/${encodeURIComponent(orderId)}/notes?${params.toString()}`,
    );
    return {
      items: data ?? [],
      page: meta?.page ?? page,
      limit: meta?.limit ?? limit,
      total: meta?.total ?? 0,
    };
  } catch {
    return { items: [], page, limit, total: 0 };
  }
}

export async function appendOrderNote(
  orderId: string,
  payload: { body: string; authorName: string; authorId?: string },
): Promise<OrderNote> {
  const { data } = await apiFetch<OrderNote>(
    `/v1/admin/orders/${encodeURIComponent(orderId)}/notes`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (!data) throw new Error('appendOrderNote returned no data');
  return data;
}

// ----- Customer notes (Phase 44) -----

export async function listCustomerNotes(
  customerId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{ items: CustomerNote[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 100;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  try {
    const { data, meta } = await apiFetch<CustomerNote[]>(
      `/v1/admin/customers/${encodeURIComponent(customerId)}/notes?${params.toString()}`,
    );
    return {
      items: data ?? [],
      page: meta?.page ?? page,
      limit: meta?.limit ?? limit,
      total: meta?.total ?? 0,
    };
  } catch {
    return { items: [], page, limit, total: 0 };
  }
}

export async function appendCustomerNote(
  customerId: string,
  payload: { body: string; authorName: string; authorId?: string },
): Promise<CustomerNote> {
  const { data } = await apiFetch<CustomerNote>(
    `/v1/admin/customers/${encodeURIComponent(customerId)}/notes`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (!data) throw new Error('appendCustomerNote returned no data');
  return data;
}

// ----- Customers (Phase 34) -----

export async function listCustomers(
  opts: {
    page?: number;
    limit?: number;
    query?: string;
    group?: CustomerGroup;
    acceptsMarketing?: boolean;
  } = {},
): Promise<{ items: Customer[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.query) params.set('query', opts.query);
  if (opts.group) params.set('group', opts.group);
  if (opts.acceptsMarketing !== undefined) {
    params.set('acceptsMarketing', String(opts.acceptsMarketing));
  }
  const { data, meta } = await apiFetch<Customer[]>(
    `/v1/admin/customers?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export interface CustomerLifetimeStats {
  orderCount: number;
  lifetimeValue: string;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

export interface CustomerDetail {
  customer: Customer;
  orders: Order[];
  stats: CustomerLifetimeStats;
}

export async function getCustomer(
  id: string,
  opts: { orderLimit?: number } = {},
): Promise<CustomerDetail | null> {
  const params = new URLSearchParams();
  if (opts.orderLimit) params.set('orderLimit', String(opts.orderLimit));
  const qs = params.toString();
  const { data } = await apiFetch<CustomerDetail>(
    `/v1/admin/customers/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
  );
  return data;
}

// ----- Outbound webhooks (Phase 14) -----

export async function listWebhookSubscriptions(
  opts: { page?: number; limit?: number } = {},
): Promise<{
  items: WebhookSubscription[];
  page: number;
  limit: number;
  total: number;
}> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const { data, meta } = await apiFetch<WebhookSubscription[]>(
    `/v1/admin/webhooks?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function getWebhookSubscription(
  id: string,
): Promise<WebhookSubscription | null> {
  const { data } = await apiFetch<WebhookSubscription>(
    `/v1/admin/webhooks/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function listReviews(
  opts: { page?: number; limit?: number; status?: ReviewStatus } = {},
): Promise<{ items: Review[]; page: number; limit: number; total: number }> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  const { data, meta } = await apiFetch<Review[]>(
    `/v1/admin/reviews?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}

export async function listWebhookDeliveries(
  opts: {
    page?: number;
    limit?: number;
    status?: WebhookDeliveryStatus;
    subscriptionId?: string;
    eventType?: string;
  } = {},
): Promise<{
  items: WebhookDelivery[];
  page: number;
  limit: number;
  total: number;
}> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) params.set('status', opts.status);
  if (opts.subscriptionId) params.set('subscriptionId', opts.subscriptionId);
  if (opts.eventType) params.set('eventType', opts.eventType);
  const { data, meta } = await apiFetch<WebhookDelivery[]>(
    `/v1/admin/webhook-deliveries?${params.toString()}`,
  );
  return {
    items: data ?? [],
    page: meta?.page ?? page,
    limit: meta?.limit ?? limit,
    total: meta?.total ?? 0,
  };
}


export interface SearchHit {
  productId: string;
  slug: string;
  name: Record<string, string>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  similarity: number;
}

export interface SearchMeta {
  query: string;
  model: string;
  dimensions: number;
  inputTokens: number;
}

export async function searchProductsByQuery(
  query: string,
  opts: { limit?: number } = {},
): Promise<{ hits: SearchHit[]; meta: SearchMeta | null }> {
  const tenantHeaders = await resolveTenantHeaders();
  const params = new URLSearchParams({ q: query });
  if (opts.limit) params.set('limit', String(opts.limit));
  try {
    const res = await fetch(
      `${API_URL}/v1/search/products?${params.toString()}`,
      {
        headers: {
          accept: 'application/json',
          ...tenantHeaders,
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return { hits: [], meta: null };
    const body = (await res.json()) as { data: SearchHit[]; meta: SearchMeta };
    return { hits: body.data, meta: body.meta };
  } catch {
    return { hits: [], meta: null };
  }
}
