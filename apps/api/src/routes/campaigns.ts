import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateEmailCampaignInputSchema,
  EmailCampaignSchema,
  EmailCampaignStatusSchema,
  UpdateEmailCampaignInputSchema,
} from '@claudeshop/contracts/crm';
import {
  SystemClock,
  sendEmailCampaign,
  type CustomerRepository,
  type CustomerSegmentRepository,
  type EmailCampaignRepository,
  type EmailProvider,
} from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface CampaignRoutesDeps {
  repo: EmailCampaignRepository;
  segmentRepo: CustomerSegmentRepository;
  customerRepo: CustomerRepository;
  email: EmailProvider;
  fromAddress: string;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerCampaignRoutes(
  app: FastifyInstance,
  deps: CampaignRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const clock = new SystemClock();

  zApp.get(
    '/v1/admin/campaigns',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
          status: EmailCampaignStatusSchema.optional(),
        }),
        response: {
          200: z.object({
            data: z.array(EmailCampaignSchema),
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
      const { items, total } = await deps.repo.list(tenantId, {
        page,
        limit,
        ...(request.query.status ? { status: request.query.status } : {}),
      });
      return { data: items, meta: { page, limit, total } };
    },
  );

  zApp.post(
    '/v1/admin/campaigns',
    {
      schema: {
        body: CreateEmailCampaignInputSchema,
        response: { 201: z.object({ data: EmailCampaignSchema }) },
      },
    },
    async (request, reply) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const campaign = await deps.repo.create(tenantId, request.body);
      return reply.status(201).send({ data: campaign });
    },
  );

  zApp.get(
    '/v1/admin/campaigns/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: EmailCampaignSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const campaign = await deps.repo.findById(tenantId, request.params.id);
      if (!campaign) throw new NotFoundError(`Campaign ${request.params.id} not found`);
      return { data: campaign };
    },
  );

  zApp.patch(
    '/v1/admin/campaigns/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateEmailCampaignInputSchema,
        response: { 200: z.object({ data: EmailCampaignSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const campaign = await deps.repo.update(
        tenantId,
        request.params.id,
        request.body,
      );
      return { data: campaign };
    },
  );

  zApp.delete(
    '/v1/admin/campaigns/:id',
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
      await deps.repo.delete(tenantId, request.params.id);
      return { data: { deleted: true } };
    },
  );

  zApp.post(
    '/v1/admin/campaigns/:id/send',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: EmailCampaignSchema }) },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });
      const campaign = await sendEmailCampaign(request.params.id, {
        tenantId,
        campaignRepo: deps.repo,
        segmentRepo: deps.segmentRepo,
        customerRepo: deps.customerRepo,
        email: deps.email,
        clock,
        fromAddress: deps.fromAddress,
      });
      return { data: campaign };
    },
  );
}
