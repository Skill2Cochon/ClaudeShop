import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateWebhookSubscriptionInputSchema,
  UpdateWebhookSubscriptionInputSchema,
  WebhookDeliverySchema,
  WebhookDeliveryStatusSchema,
  WebhookSubscriptionSchema,
} from '@claudeshop/contracts/webhook';
import type {
  HttpClient,
  WebhookDeliveryRepository,
  WebhookSubscriptionRepository,
} from '@claudeshop/core';
import { SystemClock, redeliverWebhook } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface WebhookRoutesDeps {
  subscriptionRepo: WebhookSubscriptionRepository;
  deliveryRepo: WebhookDeliveryRepository;
  http: HttpClient;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerWebhookSubscriptionRoutes(
  app: FastifyInstance,
  deps: WebhookRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.get(
    '/v1/admin/webhooks',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        }),
        response: {
          200: z.object({
            data: z.array(WebhookSubscriptionSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 50;
      const { items, total } = await deps.subscriptionRepo.list(tenantId, {
        page,
        limit,
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/webhooks',
    {
      schema: {
        body: CreateWebhookSubscriptionInputSchema,
        response: { 201: z.object({ data: WebhookSubscriptionSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const secret = request.body.secret ?? `whk_${randomBytes(24).toString('hex')}`;
      const sub = await deps.subscriptionRepo.create(tenantId, {
        ...request.body,
        secret,
      });
      return reply.status(201).send({ data: sub });
    },
  );

  zApp.get(
    '/v1/admin/webhooks/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: WebhookSubscriptionSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const sub = await deps.subscriptionRepo.findById(tenantId, request.params.id);
      if (!sub) throw new NotFoundError(`Webhook ${request.params.id} not found`);
      return { data: sub };
    },
  );

  zApp.patch(
    '/v1/admin/webhooks/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateWebhookSubscriptionInputSchema,
        response: { 200: z.object({ data: WebhookSubscriptionSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const sub = await deps.subscriptionRepo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: sub };
    },
  );

  zApp.delete(
    '/v1/admin/webhooks/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: z.object({ deleted: z.boolean() }) }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      await deps.subscriptionRepo.delete(tenantId, request.params.id);
      return { data: { deleted: true } };
    },
  );

  // --- Delivery log -------------------------------------------------------

  zApp.get(
    '/v1/admin/webhook-deliveries',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: WebhookDeliveryStatusSchema.optional(),
          eventType: z.string().optional(),
          subscriptionId: z.string().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(WebhookDeliverySchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 50;
      const { items, total } = await deps.deliveryRepo.list(tenantId, {
        page,
        limit,
        ...(request.query.status ? { status: request.query.status } : {}),
        ...(request.query.eventType ? { eventType: request.query.eventType } : {}),
        ...(request.query.subscriptionId
          ? { subscriptionId: request.query.subscriptionId }
          : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  // --- Manual redeliver ---------------------------------------------------

  const clock = new SystemClock();

  zApp.post(
    '/v1/admin/webhook-deliveries/:id/redeliver',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: WebhookDeliverySchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const delivery = await redeliverWebhook(
        { deliveryId: request.params.id },
        {
          tenantId,
          subscriptionRepo: deps.subscriptionRepo,
          deliveryRepo: deps.deliveryRepo,
          http: deps.http,
          clock,
        },
      );
      return { data: delivery };
    },
  );
}
