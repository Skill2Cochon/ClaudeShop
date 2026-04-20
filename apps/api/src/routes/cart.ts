import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AddToCartInputSchema, CartSchema, UpdateCartItemInputSchema } from '@claudeshop/contracts/cart';
import { CuidSchema } from '@claudeshop/contracts/common';
import { addToCart, type CartRepository, type VariantRepository } from '@claudeshop/core';
import { NotFoundError } from '@claudeshop/errors';

export interface CartRoutesDeps {
  cartRepo: CartRepository;
  variantRepo: VariantRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
  /** Resolve the currency for the current request (tenant default, Phase 2 stub). */
  resolveCurrency?: (request: { headers: Record<string, unknown> }) => string;
}

export async function registerCartRoutes(
  app: FastifyInstance,
  deps: CartRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();
  const resolveCurrency = deps.resolveCurrency ?? (() => 'EUR');

  // --- POST /v1/cart/items --------------------------------------------------
  zApp.post('/v1/cart/items', {
    schema: {
      body: AddToCartInputSchema,
      response: { 200: z.object({ data: CartSchema }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const currency = resolveCurrency({ headers: request.headers as Record<string, unknown> });
    const cart = await addToCart(request.body, {
      tenantId,
      currency,
      cartRepo: deps.cartRepo,
      variantRepo: deps.variantRepo,
    });
    return { data: cart };
  });

  // --- PATCH /v1/cart/items/:itemId -----------------------------------------
  zApp.patch('/v1/cart/items/:itemId', {
    schema: {
      params: z.object({ itemId: CuidSchema }),
      body: UpdateCartItemInputSchema.omit({ itemId: true }),
      response: { 200: z.object({ data: CartSchema }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const cart = await deps.cartRepo.updateItemQty(
      tenantId,
      request.body.cartId,
      request.params.itemId,
      request.body.qty,
    );
    return { data: cart };
  });

  // --- DELETE /v1/cart/items/:itemId ----------------------------------------
  zApp.delete('/v1/cart/:cartId/items/:itemId', {
    schema: {
      params: z.object({ cartId: CuidSchema, itemId: CuidSchema }),
      response: { 200: z.object({ data: CartSchema }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const cart = await deps.cartRepo.removeItem(
      tenantId,
      request.params.cartId,
      request.params.itemId,
    );
    return { data: cart };
  });

  // --- GET /v1/cart/:id -----------------------------------------------------
  zApp.get('/v1/cart/:id', {
    schema: {
      params: z.object({ id: CuidSchema }),
      response: { 200: z.object({ data: CartSchema }) },
    },
  }, async (request) => {
    const tenantId = deps.resolveTenantId({ headers: request.headers as Record<string, unknown> });
    const cart = await deps.cartRepo.findById(tenantId, request.params.id);
    if (!cart) throw new NotFoundError(`Cart ${request.params.id} not found`);
    return { data: cart };
  });
}
