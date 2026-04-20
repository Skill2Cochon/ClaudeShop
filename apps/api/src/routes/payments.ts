import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CuidSchema, MoneySchema } from '@claudeshop/contracts/common';
import {
  createPaymentIntent,
  refundPayment,
  RefundReasonSchema,
  sendOrderTransactional,
  type EmailProvider,
  type InventoryRepository,
  type OrderNoteRepository,
  type OrderRepository,
  type PaymentProvider,
  type PaymentRepository,
  type TenantSettingsRepository,
} from '@claudeshop/core';
import { PaymentError } from '@claudeshop/errors';

export interface PaymentRoutesDeps {
  orderRepo: OrderRepository;
  paymentProvider: PaymentProvider;
  paymentRepo: PaymentRepository;
  inventoryRepo: InventoryRepository;
  emailProvider?: EmailProvider;
  tenantSettingsRepo?: TenantSettingsRepository;
  /** Phase 43 — when present, refund route writes a system note. */
  orderNoteRepo?: OrderNoteRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  deps: PaymentRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const PaymentIntentResponseSchema = z.object({
    data: z.object({
      orderId: CuidSchema,
      orderNumber: z.string(),
      providerRef: z.string(),
      clientSecret: z.string(),
      amount: z.string(),
      currency: z.string(),
    }),
  });

  // --- POST /v1/orders/:id/pay ---------------------------------------------
  zApp.post('/v1/orders/:id/pay', {
    schema: {
      params: z.object({ id: CuidSchema }),
      response: { 201: PaymentIntentResponseSchema },
    },
  }, async (request, reply) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const result = await createPaymentIntent(
      { orderId: request.params.id },
      {
        tenantId,
        orderRepo: deps.orderRepo,
        paymentProvider: deps.paymentProvider,
        paymentRepo: deps.paymentRepo,
      },
    );
    return reply.status(201).send({ data: result });
  });

  // --- POST /v1/orders/:id/refund ------------------------------------------
  const RefundBodySchema = z.object({
    amount: MoneySchema.optional(),
    reason: RefundReasonSchema.optional(),
    /** Phase 2.6 transitional override — normally resolved from Payment row. */
    providerRef: z.string().min(4).optional(),
  });

  const RefundResponseSchema = z.object({
    data: z.object({
      orderId: CuidSchema,
      orderNumber: z.string(),
      refundId: z.string(),
      amount: z.string(),
      currency: z.string(),
      isFullRefund: z.boolean(),
    }),
  });

  zApp.post('/v1/orders/:id/refund', {
    schema: {
      params: z.object({ id: CuidSchema }),
      body: RefundBodySchema,
      response: { 201: RefundResponseSchema },
    },
  }, async (request, reply) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const orderId = request.params.id;

    // Phase 2.7: resolve providerRef from the Payment table by default.
    let providerRef = request.body.providerRef;
    if (!providerRef) {
      const latest = await deps.paymentRepo.findLatestForOrder(tenantId, orderId);
      providerRef = latest?.providerRef;
    }
    if (!providerRef) {
      throw new PaymentError(
        'No completed payment found for this order — nothing to refund.',
        { details: { orderId } },
      );
    }

    const result = await refundPayment(
      {
        orderId,
        providerRef,
        ...(request.body.amount ? { amount: request.body.amount } : {}),
        ...(request.body.reason ? { reason: request.body.reason } : {}),
      },
      {
        tenantId,
        orderRepo: deps.orderRepo,
        paymentProvider: deps.paymentProvider,
        inventoryRepo: deps.inventoryRepo,
      },
    );

    // Mark the Payment row as REFUNDED (full) or keep CAPTURED (partial).
    if (result.isFullRefund) {
      const payment = await deps.paymentRepo.findByProviderRef(
        tenantId,
        deps.paymentProvider.name,
        providerRef,
      );
      if (payment) {
        await deps.paymentRepo.updateStatus(tenantId, payment.id, 'REFUNDED');
      }
    }

    // Phase 43: append a system note on the order timeline so the
    // merchant sees the refund inline with other activity. Best-effort
    // — the PSP refund has already cleared, we can't undo it if the
    // note layer blips.
    if (deps.orderNoteRepo) {
      try {
        const label = result.isFullRefund ? 'Full refund' : 'Partial refund';
        const reasonBit = request.body.reason
          ? ` · reason: ${request.body.reason}`
          : '';
        await deps.orderNoteRepo.append(tenantId, {
          orderId,
          authorType: 'system',
          authorId: null,
          authorName: 'ClaudeShop',
          body: `${label} of ${result.amount} ${result.currency} issued${reasonBit}.`,
        });
      } catch (err) {
        request.log.warn(
          { err, orderId, tenantId },
          'System note on refund failed — continuing',
        );
      }
    }

    // Phase 32: fire the refund transactional email best-effort. The
    // refund has already settled with the PSP; a comms failure can't
    // undo it.
    if (deps.emailProvider && deps.tenantSettingsRepo) {
      try {
        const refreshedOrder = await deps.orderRepo.findById(tenantId, orderId);
        if (refreshedOrder) {
          const settings = await deps.tenantSettingsRepo.get(tenantId);
          await sendOrderTransactional(
            {
              kind: 'refunded',
              order: refreshedOrder,
              refundAmount: result.amount,
              isFullRefund: result.isFullRefund,
              refundReason: request.body.reason ?? null,
            },
            { tenantId, email: deps.emailProvider, settings },
          );
        }
      } catch (err) {
        request.log.warn({ err }, 'Refund transactional email failed');
      }
    }

    return reply.status(201).send({ data: result });
  });

  // --- GET /v1/orders/:id/payments -----------------------------------------
  // Phase 2.7 — list payments for an order (refund history + retries).
  const PaymentListItemSchema = z.object({
    id: CuidSchema,
    orderId: CuidSchema,
    provider: z.string(),
    providerRef: z.string(),
    status: z.enum([
      'PENDING',
      'AUTHORIZED',
      'CAPTURED',
      'FAILED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ]),
    amount: z.string(),
    currency: z.string(),
    idempotencyKey: z.string(),
    capturedAt: z.string().nullable(),
    createdAt: z.string(),
  });

  zApp.get('/v1/orders/:id/payments', {
    schema: {
      params: z.object({ id: CuidSchema }),
      response: { 200: z.object({ data: z.array(PaymentListItemSchema) }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const payments = await deps.paymentRepo.listByOrder(tenantId, request.params.id);
    return { data: payments };
  });
}
