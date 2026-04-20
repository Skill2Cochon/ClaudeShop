import type { Product } from '@claudeshop/contracts/product';
import type { Cart } from '@claudeshop/contracts/cart';
import type {
  CustomerAddress,
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from '@claudeshop/contracts/customer';
import type {
  Order,
  OrderStatus,
  OrderTotals,
} from '@claudeshop/contracts/order';
import type { Page } from '@claudeshop/contracts/page';
import type { Category } from '@claudeshop/contracts/category';
import type { Review, ReviewSummary } from '@claudeshop/contracts/review';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Tenant addressing (Phase 60).
 *
 * Preferred order:
 *   1. STOREFRONT_TENANT_ID (explicit operator override — CUID)
 *   2. SEEDED_DEMO_TENANT_ID (written by `pnpm db:seed` to apps/storefront/.env.local)
 *   3. fall back to the slug header — resolved server-side via Prisma+LRU cache
 *
 * This keeps fresh installs working out-of-the-box: the operator never
 * has to hand-copy the seed-generated CUID into an env file before the
 * storefront renders its first page.
 */
const TENANT_ID_ENV =
  process.env.STOREFRONT_TENANT_ID ?? process.env.SEEDED_DEMO_TENANT_ID ?? '';
const TENANT_SLUG_ENV =
  process.env.STOREFRONT_TENANT_SLUG ?? process.env.SEEDED_DEMO_TENANT_SLUG ?? 'demo';

function tenantHeaders(): Record<string, string> {
  // Prefer CUID when known (no server-side lookup cost); otherwise fall
  // back to slug which the API resolves via a cached Prisma query.
  if (TENANT_ID_ENV && TENANT_ID_ENV.length >= 8) {
    return { 'x-tenant-id': TENANT_ID_ENV };
  }
  return { 'x-tenant-slug': TENANT_SLUG_ENV };
}

interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
}

type FetchOpts = RequestInit & { cache?: 'no-store' | 'force-cache' };

async function apiFetch<T>(path: string, init: FetchOpts = {}): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders(),
      ...(init.headers ?? {}),
    },
    // Non-GET: dynamic. GET: ISR with per-path tag.
    ...(init.method && init.method !== 'GET'
      ? { cache: 'no-store' as const }
      : { next: { revalidate: 60, tags: [path] } }),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    // Phase 60 — always include status + path so operators see the real
    // cause in the Next.js error overlay. v0.1 fell back to a generic
    // "Internal server error" string which hid 500s behind guesswork.
    const serverMessage = body?.error?.message ?? body?.error?.code;
    const prefix = `API ${res.status} on ${path}`;
    throw new Error(serverMessage ? `${prefix}: ${serverMessage}` : prefix);
  }
  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}

// ----- Products -----

export async function getProductBySlug(
  slug: string,
  opts: { priceFor?: string } = {},
): Promise<Product | null> {
  const params = new URLSearchParams();
  if (opts.priceFor) params.set('priceFor', opts.priceFor);
  const qs = params.toString();
  return apiFetch<Product>(
    `/v1/products/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`,
  );
}

export async function listProducts(
  opts: { page?: number; limit?: number; priceFor?: string } = {},
): Promise<Product[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status: 'ACTIVE',
  });
  if (opts.priceFor) params.set('priceFor', opts.priceFor);
  return (await apiFetch<Product[]>(`/v1/products?${params.toString()}`)) ?? [];
}

// ----- Semantic search (Phase 4.4) -----

export interface SearchProductHit {
  productId: string;
  slug: string;
  name: Record<string, string>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  similarity: number;
}

export async function searchProductsByQuery(
  query: string,
  opts: { limit?: number } = {},
): Promise<SearchProductHit[]> {
  if (query.trim().length === 0) return [];
  const params = new URLSearchParams({ q: query });
  if (opts.limit) params.set('limit', String(opts.limit));
  return (
    (await apiFetch<SearchProductHit[]>(`/v1/search/products?${params.toString()}`)) ?? []
  );
}

export async function getRelatedProducts(
  productId: string,
  opts: { limit?: number } = {},
): Promise<SearchProductHit[]> {
  const params = new URLSearchParams({ productId });
  if (opts.limit) params.set('limit', String(opts.limit));
  return (
    (await apiFetch<SearchProductHit[]>(`/v1/search/related?${params.toString()}`)) ?? []
  );
}

// ----- CMS pages (Phase 6) -----

export async function getPublishedPage(slug: string): Promise<Page | null> {
  return apiFetch<Page>(`/v1/pages/${encodeURIComponent(slug)}`);
}

// ----- Reviews (Phase 18) -----

export interface ReviewListResponse {
  data: Review[];
  meta: {
    page: number;
    limit: number;
    total: number;
    summary: ReviewSummary;
  };
}

export async function getProductReviews(
  slug: string,
  opts: { page?: number; limit?: number } = {},
): Promise<ReviewListResponse | null> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 10;
  try {
    const res = await fetch(
      `${API_URL}/v1/products/${encodeURIComponent(slug)}/reviews?page=${page}&limit=${limit}`,
      {
        headers: {
          accept: 'application/json',
          ...tenantHeaders(),
        },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as ReviewListResponse;
  } catch {
    return null;
  }
}

export async function submitReview(payload: {
  productId: string;
  rating: number;
  title?: string;
  body?: string;
  authorName: string;
  authUserId?: string;
}): Promise<Review | null> {
  return apiFetch<Review>('/v1/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ----- Categories (Phase 13) -----

export async function listCategories(
  opts: { rootOnly?: boolean } = {},
): Promise<Category[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (opts.rootOnly) params.set('rootOnly', 'true');
  return (await apiFetch<Category[]>(`/v1/categories?${params.toString()}`)) ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return apiFetch<Category>(`/v1/categories/${encodeURIComponent(slug)}`);
}

export async function listCategoryProducts(
  slug: string,
  opts: { page?: number; limit?: number; priceFor?: string } = {},
): Promise<Product[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 24;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.priceFor) params.set('priceFor', opts.priceFor);
  return (
    (await apiFetch<Product[]>(
      `/v1/categories/${encodeURIComponent(slug)}/products?${params.toString()}`,
    )) ?? []
  );
}

// ----- Promotions (Phase 7) -----

export interface AppliedPromotionResult {
  promotionId: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discount: string;
  shippingDiscount: string;
  currency: string;
  summary: string;
}

export async function applyPromotionCode(payload: {
  code: string;
  subtotal: string;
  currency: string;
  shipping?: string;
}): Promise<AppliedPromotionResult | null> {
  return apiFetch<AppliedPromotionResult>('/v1/promotions/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ----- Cart -----

export async function getCart(cartId: string): Promise<Cart | null> {
  return apiFetch<Cart>(`/v1/cart/${encodeURIComponent(cartId)}`, { cache: 'no-store' });
}

export async function addToCart(body: {
  variantId: string;
  qty: number;
  cartId?: string;
  anonymousId?: string;
}): Promise<Cart> {
  const cart = await apiFetch<Cart>('/v1/cart/items', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!cart) throw new Error('addToCart returned no data');
  return cart;
}

export async function updateCartItem(
  itemId: string,
  body: { cartId: string; qty: number },
): Promise<Cart> {
  const cart = await apiFetch<Cart>(`/v1/cart/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!cart) throw new Error('updateCartItem returned no data');
  return cart;
}

export async function removeCartItem(cartId: string, itemId: string): Promise<Cart> {
  const cart = await apiFetch<Cart>(
    `/v1/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
  if (!cart) throw new Error('removeCartItem returned no data');
  return cart;
}

// ----- Orders -----

export async function placeOrder(body: {
  cartId: string;
  customerEmail?: string;
  shippingAddress?: {
    country: string;
    region?: string;
    postcode?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    line1?: string;
    line2?: string;
    city?: string;
    phone?: string;
  };
  promotionCode?: string;
}): Promise<Order> {
  const order = await apiFetch<Order>('/v1/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!order) throw new Error('placeOrder returned no data');
  return order;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  return apiFetch<Order>(`/v1/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
}

// ----- Customer address book (Phase 50) -----

/**
 * Fetch against an account-scoped endpoint. Attaches
 * x-customer-email so the API can resolve the caller's Customer
 * row + always disables caching (addresses are private and
 * per-customer).
 */
async function accountFetch<T>(
  path: string,
  customerEmail: string,
  init: RequestInit = {},
): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders(),
      'x-customer-email': customerEmail,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (res.status === 204) return null;
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(
      body?.error?.message ?? `API error ${res.status} on ${path}`,
    );
  }
  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}

export async function listAddresses(
  customerEmail: string,
): Promise<CustomerAddress[]> {
  return (await accountFetch<CustomerAddress[]>(
    '/v1/account/addresses',
    customerEmail,
  )) ?? [];
}

export async function getAddress(
  customerEmail: string,
  id: string,
): Promise<CustomerAddress | null> {
  return accountFetch<CustomerAddress>(
    `/v1/account/addresses/${encodeURIComponent(id)}`,
    customerEmail,
  );
}

export async function createAddress(
  customerEmail: string,
  input: CreateCustomerAddressInput,
): Promise<CustomerAddress> {
  const address = await accountFetch<CustomerAddress>(
    '/v1/account/addresses',
    customerEmail,
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (!address) throw new Error('createAddress returned no data');
  return address;
}

export async function updateAddress(
  customerEmail: string,
  id: string,
  input: UpdateCustomerAddressInput,
): Promise<CustomerAddress> {
  const address = await accountFetch<CustomerAddress>(
    `/v1/account/addresses/${encodeURIComponent(id)}`,
    customerEmail,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  if (!address) throw new Error('updateAddress returned no data');
  return address;
}

export async function deleteAddress(
  customerEmail: string,
  id: string,
): Promise<void> {
  await accountFetch<null>(
    `/v1/account/addresses/${encodeURIComponent(id)}`,
    customerEmail,
    { method: 'DELETE' },
  );
}

export async function setDefaultAddress(
  customerEmail: string,
  id: string,
): Promise<CustomerAddress> {
  const address = await accountFetch<CustomerAddress>(
    `/v1/account/addresses/${encodeURIComponent(id)}/default`,
    customerEmail,
    { method: 'POST' },
  );
  if (!address) throw new Error('setDefaultAddress returned no data');
  return address;
}

// ----- Password change (Phase 59) -----

/**
 * Swap the current password for a new one. Throws with the API
 * error message on 4xx (wrong current password, same-as-current,
 * invalid shape). Returns void on success — callers should invalidate
 * the session if they want "logout everywhere" behaviour.
 */
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/v1/auth/change-password`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders(),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as ApiError | null;
  throw new Error(
    body?.error?.message ?? `Password change failed (${res.status})`,
  );
}

// ----- Newsletter opt-in (Phase 58) -----

/**
 * Public opt-in. Returns true on a 204, throws with the API error
 * message on any other status. Idempotent — safe to call with an
 * email that's already subscribed.
 */
export async function subscribeToNewsletter(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
}): Promise<boolean> {
  const res = await fetch(`${API_URL}/v1/public/subscribe`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...tenantHeaders(),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (res.status === 204) return true;
  const body = (await res.json().catch(() => null)) as ApiError | null;
  throw new Error(
    body?.error?.message ?? `Subscribe failed (${res.status})`,
  );
}

// ----- Public guest order tracking (Phase 36) -----

export interface TrackedOrder {
  number: string;
  status: OrderStatus;
  currency: string;
  totals: OrderTotals;
  lines: Array<{
    id: string;
    productName: string;
    sku: string;
    qty: number;
    unitPrice: string;
    total: string;
  }>;
  placedAt: string | null;
  updatedAt: string;
}

/**
 * Look up a guest order by its public order number + the email used
 * at checkout. Returns null when either field doesn't match — the
 * API 404s uniformly so we can't tell which side failed.
 */
export async function trackGuestOrder(
  number: string,
  email: string,
): Promise<TrackedOrder | null> {
  const params = new URLSearchParams({ number, email });
  return apiFetch<TrackedOrder>(
    `/v1/public/orders/track?${params.toString()}`,
    { cache: 'no-store' },
  );
}

export async function listOrders(
  opts: { page?: number; limit?: number } = {},
): Promise<Order[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  return (await apiFetch<Order[]>(`/v1/orders?page=${page}&limit=${limit}`)) ?? [];
}

export async function listOrdersByCustomer(
  customerEmail: string,
  opts: { page?: number; limit?: number; status?: OrderStatus } = {},
): Promise<Order[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    customerEmail,
  });
  if (opts.status) params.set('status', opts.status);
  return (await apiFetch<Order[]>(`/v1/orders?${params.toString()}`)) ?? [];
}

// ----- Wishlist (Phase 27) -----

export interface WishlistEntry {
  productId: string;
  createdAt: string;
  product: {
    id: string;
    slug: string;
    name: Record<string, string>;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  } | null;
}

export async function listWishlist(customerId: string): Promise<WishlistEntry[]> {
  const params = new URLSearchParams({ customerId });
  return (await apiFetch<WishlistEntry[]>(`/v1/wishlist?${params.toString()}`)) ?? [];
}

export async function toggleWishlist(
  customerId: string,
  productId: string,
): Promise<{ favourited: boolean }> {
  const result = await apiFetch<{ favourited: boolean }>('/v1/wishlist/toggle', {
    method: 'POST',
    body: JSON.stringify({ customerId, productId }),
  });
  if (!result) throw new Error('toggleWishlist returned no data');
  return result;
}
