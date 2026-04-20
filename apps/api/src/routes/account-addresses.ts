import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateCustomerAddressInputSchema,
  CustomerAddressSchema,
  UpdateCustomerAddressInputSchema,
} from '@claudeshop/contracts/customer';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type {
  CustomerAddressRepository,
  CustomerRepository,
} from '@claudeshop/core';

export interface AccountAddressRoutesDeps {
  addressRepo: CustomerAddressRepository;
  customerRepo: CustomerRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Phase 50 — registered-customer address book.
 *
 *   GET    /v1/account/addresses
 *   POST   /v1/account/addresses
 *   GET    /v1/account/addresses/:id
 *   PATCH  /v1/account/addresses/:id
 *   DELETE /v1/account/addresses/:id
 *   POST   /v1/account/addresses/:id/default
 *
 * Customer identity arrives as `x-customer-email` — the storefront
 * server-side layer reads its iron-session and attaches the header
 * on every request. The API resolves the email to a Customer row
 * and enforces ownership at the repository layer. A future
 * bearer-auth pass will replace the header with a signed JWT.
 */
export async function registerAccountAddressRoutes(
  app: FastifyInstance,
  deps: AccountAddressRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  async function resolveCustomerId(
    request: FastifyRequest,
  ): Promise<{ tenantId: string; customerId: string }> {
    const tenantId = deps.resolveTenantId({
      headers: request.headers as Record<string, unknown>,
    });
    const raw = request.headers['x-customer-email'];
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!email) {
      throw new ValidationError('Missing x-customer-email header');
    }
    const customer = await deps.customerRepo.findByEmail(tenantId, email);
    if (!customer) {
      throw new NotFoundError('Customer not found for this email');
    }
    return { tenantId, customerId: customer.id };
  }

  zApp.get(
    '/v1/account/addresses',
    {
      schema: {
        response: {
          200: z.object({ data: z.array(CustomerAddressSchema) }),
        },
      },
    },
    async (request) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      const items = await deps.addressRepo.list(tenantId, customerId);
      return { data: items };
    },
  );

  zApp.post(
    '/v1/account/addresses',
    {
      schema: {
        body: CreateCustomerAddressInputSchema,
        response: { 201: z.object({ data: CustomerAddressSchema }) },
      },
    },
    async (request, reply) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      const created = await deps.addressRepo.create(
        tenantId,
        customerId,
        request.body,
      );
      return reply.status(201).send({ data: created });
    },
  );

  zApp.get(
    '/v1/account/addresses/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: CustomerAddressSchema }) },
      },
    },
    async (request) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      const address = await deps.addressRepo.findById(
        tenantId,
        customerId,
        request.params.id,
      );
      if (!address) {
        throw new NotFoundError(`Address ${request.params.id} not found`);
      }
      return { data: address };
    },
  );

  zApp.patch(
    '/v1/account/addresses/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: UpdateCustomerAddressInputSchema,
        response: { 200: z.object({ data: CustomerAddressSchema }) },
      },
    },
    async (request) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      const updated = await deps.addressRepo.update(
        tenantId,
        customerId,
        request.params.id,
        request.body,
      );
      return { data: updated };
    },
  );

  zApp.delete(
    '/v1/account/addresses/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      await deps.addressRepo.remove(tenantId, customerId, request.params.id);
      return reply.status(204).send(null);
    },
  );

  zApp.post(
    '/v1/account/addresses/:id/default',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ data: CustomerAddressSchema }) },
      },
    },
    async (request) => {
      const { tenantId, customerId } = await resolveCustomerId(request);
      const updated = await deps.addressRepo.setDefault(
        tenantId,
        customerId,
        request.params.id,
      );
      return { data: updated };
    },
  );
}
