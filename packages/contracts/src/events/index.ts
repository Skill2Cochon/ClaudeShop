import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema } from '../common/primitives';

/**
 * Event Topic Registry — every async/sync event flowing through the EventBus.
 * Consumers (modules, workers) reference these topics via TopicName.
 * Producers must validate payload via the Zod schema before emit.
 *
 * Add new topics here; the module-kit can introspect this registry.
 */

export const EventEnvelopeSchema = z.object({
  topic: z.string(),
  tenantId: CuidSchema,
  occurredAt: IsoDateTimeSchema,
  actorType: z.enum(['user', 'api-key', 'system', 'module', 'ai']),
  actorId: z.string().nullable(),
  traceId: z.string().optional(),
});

// Product events
export const ProductCreatedPayloadSchema = EventEnvelopeSchema.extend({
  productId: CuidSchema,
});
export const ProductUpdatedPayloadSchema = EventEnvelopeSchema.extend({
  productId: CuidSchema,
  changedFields: z.array(z.string()),
});
export const ProductDeletedPayloadSchema = EventEnvelopeSchema.extend({
  productId: CuidSchema,
});

// Order events
export const OrderPlacedPayloadSchema = EventEnvelopeSchema.extend({
  orderId: CuidSchema,
  customerId: CuidSchema.nullable(),
  total: z.string(),
  currency: z.string(),
});
export const OrderPaidPayloadSchema = EventEnvelopeSchema.extend({
  orderId: CuidSchema,
  paymentId: CuidSchema,
});
export const OrderShippedPayloadSchema = EventEnvelopeSchema.extend({
  orderId: CuidSchema,
  shipmentId: CuidSchema,
});
export const OrderCancelledPayloadSchema = EventEnvelopeSchema.extend({
  orderId: CuidSchema,
  reason: z.string().nullable(),
});

// Inventory events
export const InventoryAdjustedPayloadSchema = EventEnvelopeSchema.extend({
  variantId: CuidSchema,
  locationId: CuidSchema,
  delta: z.number().int(),
  reason: z.string(),
});

// Customer events
export const CustomerCreatedPayloadSchema = EventEnvelopeSchema.extend({
  customerId: CuidSchema,
});

// Module lifecycle events (emitted by the plugin runtime)
export const ModuleInstalledPayloadSchema = EventEnvelopeSchema.extend({
  moduleId: z.string(),
  version: z.string(),
});
export const ModuleActivatedPayloadSchema = EventEnvelopeSchema.extend({
  moduleId: z.string(),
});

/**
 * Central topic map — enforces compile-time safety for emit/on.
 * Add new topics here along with their payload schema.
 */
export const EVENT_TOPICS = {
  'product.created': {
    schema: ProductCreatedPayloadSchema,
    delivery: 'sync',
  },
  'product.updated': {
    schema: ProductUpdatedPayloadSchema,
    delivery: 'async',
  },
  'product.deleted': {
    schema: ProductDeletedPayloadSchema,
    delivery: 'async',
  },
  'order.placed': {
    schema: OrderPlacedPayloadSchema,
    delivery: 'sync',
  },
  'order.paid': {
    schema: OrderPaidPayloadSchema,
    delivery: 'sync',
  },
  'order.shipped': {
    schema: OrderShippedPayloadSchema,
    delivery: 'async',
  },
  'order.cancelled': {
    schema: OrderCancelledPayloadSchema,
    delivery: 'async',
  },
  'inventory.adjusted': {
    schema: InventoryAdjustedPayloadSchema,
    delivery: 'sync',
  },
  'customer.created': {
    schema: CustomerCreatedPayloadSchema,
    delivery: 'async',
  },
  'module.installed': {
    schema: ModuleInstalledPayloadSchema,
    delivery: 'async',
  },
  'module.activated': {
    schema: ModuleActivatedPayloadSchema,
    delivery: 'async',
  },
} as const;

export type TopicName = keyof typeof EVENT_TOPICS;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type EventDelivery = 'sync' | 'async';
