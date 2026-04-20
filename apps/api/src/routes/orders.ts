import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  OrderSchema,
  OrderStatusSchema,
  PlaceOrderInputSchema,
} from '@claudeshop/contracts/order';
import { CuidSchema, PaginationQuerySchema } from '@claudeshop/contracts/common';
import {
  SystemClock,
  dispatchWebhookEvent,
  placeOrder,
  sendOrderTransactional,
  type CartRepository,
  type EmailProvider,
  type HttpClient,
  type InventoryRepository,
  type OrderNoteRepository,
  type OrderRepository,
  type PromotionRepository,
  type ShippingRateRepository,
  type TaxRateRepository,
  type TenantSettingsRepository,
  type VariantRepository,
  type WebhookDeliveryRepository,
  type WebhookSubscriptionRepository,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface OrderRoutesDeps {
  cartRepo: CartRepository;
  orderRepo: OrderRepository;
  variantRepo: VariantRepository;
  inventoryRepo: InventoryRepository;
  taxRateRepo?: TaxRateRepository;
  shippingRateRepo?: ShippingRateRepository;
  webhookSubscriptionRepo?: WebhookSubscriptionRepository;
  webhookDeliveryRepo?: WebhookDeliveryRepository;
  webhookHttp?: HttpClient;
  emailProvider?: EmailProvider;
  tenantSettingsRepo?: TenantSettingsRepository;
  /** Phase 43 — seed the order timeline with "Order placed" on create. */
  orderNoteRepo?: OrderNoteRepository;
  /** Phase 53 — enables promotionCode on PlaceOrderInput. */
  promotionRepo?: PromotionRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
  /** Tenant-level prefix for order numbers. */
  numberPrefix?: string;
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  deps: OrderRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  // --- POST /v1/orders ------------------------------------------------------
  zApp.post('/v1/orders', {
    schema: {
      body: PlaceOrderInputSchema,
      response: { 201: z.object({ data: OrderSchema }) },
    },
  }, async (request, reply) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const order = await placeOrder(request.body, {
      tenantId,
      cartRepo: deps.cartRepo,
      orderRepo: deps.orderRepo,
      variantRepo: deps.variantRepo,
      inventoryRepo: deps.inventoryRepo,
      ...(deps.promotionRepo ? { promotionRepo: deps.promotionRepo } : {}),
      ...(deps.taxRateRepo ? { taxRateRepo: deps.taxRateRepo } : {}),
      ...(deps.shippingRateRepo ? { shippingRateRepo: deps.shippingRateRepo } : {}),
      ...(deps.numberPrefix ? { numberPrefix: deps.numberPrefix } : {}),
    });

    // Phase 14: fan out order.placed to subscribed merchants. Best-effort —
    // delivery failures don't fail the order; the merchant retries via the
    // delivery log + Phase 14.1 cron sweeper.
    if (deps.webhookSubscriptionRepo && deps.webhookDeliveryRepo && deps.webhookHttp) {
      try {
        await dispatchWebhookEvent(
          {
            eventType: 'order.placed',
            eventId: `order:${order.id}`,
            payload: {
              orderId: order.id,
              number: order.number,
              currency: order.currency,
              total: order.totals.total,
              customerEmail: order.anonymousEmail,
            },
          },
          {
            tenantId,
            subscriptionRepo: deps.webhookSubscriptionRepo,
            deliveryRepo: deps.webhookDeliveryRepo,
            http: deps.webhookHttp,
            clock: new SystemClock(),
          },
        );
      } catch (err) {
        request.log.warn({ err }, 'Webhook fan-out failed');
      }
    }

    // Phase 43: first entry on the internal timeline — so a merchant
    // opening the order detail in admin sees "Order placed · 2m ago"
    // instead of an empty notes section. Best-effort.
    if (deps.orderNoteRepo) {
      try {
        await deps.orderNoteRepo.append(tenantId, {
          orderId: order.id,
          authorType: 'system',
          authorId: null,
          authorName: 'ClaudeShop',
          body: `Order placed · ${order.lines.length} line${order.lines.length === 1 ? '' : 's'} · ${order.totals.total} ${order.currency}`,
        });
      } catch (err) {
        request.log.warn(
          { err, orderId: order.id, tenantId },
          'System note on order-placed failed — continuing',
        );
      }
    }

    // Phase 32: fire the order-placed transactional email best-effort.
    // A delivery failure must not roll back the order — the charge has
    // already been captured and the stock already reserved.
    if (deps.emailProvider && deps.tenantSettingsRepo) {
      try {
        const settings = await deps.tenantSettingsRepo.get(tenantId);
        await sendOrderTransactional(
          { kind: 'placed', order },
          { tenantId, email: deps.emailProvider, settings },
        );
      } catch (err) {
        request.log.warn({ err }, 'Order-placed transactional email failed');
      }
    }

    return reply.status(201).send({ data: order });
  });

  // --- GET /v1/orders -------------------------------------------------------
  const ListQuerySchema = PaginationQuerySchema.extend({
    status: OrderStatusSchema.optional(),
    customerId: CuidSchema.optional(),
    customerEmail: z.string().email().optional(),
    /** Phase 37 — admin filter bar. */
    numberQuery: z.string().trim().min(1).max(64).optional(),
    placedFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    placedTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  });

  zApp.get('/v1/orders', {
    schema: {
      querystring: ListQuerySchema,
      response: {
        200: z.object({
          data: z.array(OrderSchema),
          meta: z.object({
            page: z.number().int(),
            limit: z.number().int(),
            total: z.number().int(),
          }),
        }),
      },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });

    // Date filters come in as `YYYY-MM-DD`. Convert to full-day
    // boundaries so the admin's "2026-04-01 to 2026-04-03" picks up
    // orders placed anywhere between 00:00 on the 1st and 23:59:59
    // on the 3rd — otherwise an order placed mid-afternoon on the
    // upper-bound day would silently fall outside the range.
    const placedFrom = request.query.placedFrom
      ? `${request.query.placedFrom}T00:00:00.000Z`
      : undefined;
    const placedTo = request.query.placedTo
      ? `${request.query.placedTo}T23:59:59.999Z`
      : undefined;

    const { items, total } = await deps.orderRepo.list(tenantId, {
      page: request.query.page,
      limit: request.query.limit,
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.customerId ? { customerId: request.query.customerId } : {}),
      ...(request.query.customerEmail
        ? { customerEmail: request.query.customerEmail }
        : {}),
      ...(request.query.numberQuery
        ? { numberQuery: request.query.numberQuery }
        : {}),
      ...(placedFrom ? { placedFrom } : {}),
      ...(placedTo ? { placedTo } : {}),
    });
    return {
      data: items,
      meta: { page: request.query.page, limit: request.query.limit, total },
    };
  });

  // --- GET /v1/orders/:id ---------------------------------------------------
  zApp.get('/v1/orders/:id', {
    schema: {
      params: z.object({ id: CuidSchema }),
      response: { 200: z.object({ data: OrderSchema }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const order = await deps.orderRepo.findById(tenantId, request.params.id);
    if (!order) throw new NotFoundError(`Order ${request.params.id} not found`);
    return { data: order };
  });
}
