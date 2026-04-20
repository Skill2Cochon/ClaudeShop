import { z } from 'zod';
import {
  CuidSchema,
  MoneySchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
} from '../common/primitives';

export const OrderStatusSchema = z.enum([
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export const OrderLineSchema = z.object({
  id: CuidSchema,
  orderId: CuidSchema,
  variantId: CuidSchema,
  productName: z.string(),
  sku: z.string(),
  qty: z.number().int().min(1),
  unitPrice: MoneySchema,
  subtotal: MoneySchema,
  tax: MoneySchema.default('0'),
  discount: MoneySchema.default('0'),
  total: MoneySchema,
});

export const OrderTotalsSchema = z.object({
  subtotal: MoneySchema,
  tax: MoneySchema,
  discount: MoneySchema,
  shipping: MoneySchema,
  total: MoneySchema,
});

export const OrderSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  number: z.string(),
  customerId: CuidSchema.nullable(),
  anonymousEmail: z.string().email().nullable(),
  status: OrderStatusSchema,
  currency: CurrencyCodeSchema,
  totals: OrderTotalsSchema,
  lines: z.array(OrderLineSchema),
  placedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const PaymentSchema = z.object({
  id: CuidSchema,
  orderId: CuidSchema,
  provider: z.string(),
  providerRef: z.string(),
  status: PaymentStatusSchema,
  amount: MoneySchema,
  currency: CurrencyCodeSchema,
  idempotencyKey: z.string(),
  capturedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

/**
 * Minimal structured address used for tax & shipping-rate resolution.
 * `country/region/postcode` are the only fields the place-order use
 * case reads today; the optional contact/line fields were added in
 * Phase 35 so guest checkout can capture the full delivery destination
 * without forcing the API to care about fulfilment at order time. The
 * use case passes them through untouched — downstream fulfilment (when
 * it lands) reads them from the order's shippingAddress blob.
 */
export const ShippingAddressSchema = z
  .object({
    country: z.string().length(2).regex(/^[A-Z]{2}$/),
    region: z.string().max(20).optional(),
    postcode: z.string().max(40).optional(),
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    company: z.string().max(120).optional(),
    line1: z.string().min(1).max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional(),
  })
  .strict();
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const PlaceOrderInputSchema = z
  .object({
    cartId: CuidSchema,
    customerEmail: z.string().email().optional(),
    /**
     * When provided, the order is shipped via this rate id (Phase 8.1).
     * Computed from `applicableShippingRates` on the cart preview.
     */
    shippingRateId: CuidSchema.optional(),
    /**
     * When provided, applicable tax rates are auto-resolved from the
     * destination (Phase 8.1).
     */
    shippingAddress: ShippingAddressSchema.optional(),
    /**
     * Phase 53 — promotion code validated server-side via applyPromotion.
     * The discount lands on the order totals and the promotion's
     * redemption counter bumps atomically once the order commits.
     */
    promotionCode: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type PlaceOrderInput = z.infer<typeof PlaceOrderInputSchema>;

/**
 * Phase 42 — merchant-facing internal order timeline.
 * 'user' notes are typed by staff, 'system' notes are written by the
 * API during lifecycle events (refund issued, email retry, webhook
 * redelivery). Append-only; the UI treats them as immutable.
 */
export const OrderNoteAuthorTypeSchema = z.enum(['user', 'system']);
export const OrderNoteSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  orderId: CuidSchema,
  authorType: OrderNoteAuthorTypeSchema,
  authorId: CuidSchema.nullable(),
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  createdAt: IsoDateTimeSchema,
});

export const CreateOrderNoteInputSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type OrderNoteAuthorType = z.infer<typeof OrderNoteAuthorTypeSchema>;
export type OrderNote = z.infer<typeof OrderNoteSchema>;
export type CreateOrderNoteInput = z.infer<typeof CreateOrderNoteInputSchema>;

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type OrderTotals = z.infer<typeof OrderTotalsSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
