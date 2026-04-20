import { AddToCartInputSchema, type AddToCartInput, type Cart } from '@claudeshop/contracts/cart';
import { InventoryError, NotFoundError, ValidationError } from '@claudeshop/errors';
import type { CartRepository } from '../ports/cart-repository.js';
import type { VariantRepository } from '../ports/variant-repository.js';

export interface AddToCartDeps {
  tenantId: string;
  currency: string;
  cartRepo: CartRepository;
  variantRepo: VariantRepository;
  /** Optional channel override — defaults to "default". */
  channel?: string;
}

/**
 * Add a variant to the customer's active cart. Creates the cart if none
 * exists for the session (anonymous or authenticated).
 *
 * Contract:
 * - Input is Zod-validated. Either `cartId` or `anonymousId` must be present.
 * - Variant price must exist for the requested currency → NotFoundError.
 * - Requested qty must not exceed available stock → InventoryError.
 * - Existing cart line for the same variant gets qty incremented, not duplicated.
 */
export async function addToCart(
  input: AddToCartInput,
  deps: AddToCartDeps,
): Promise<Cart> {
  const parsed = AddToCartInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid addToCart input', { details: parsed.error.issues });
  }
  if (!parsed.data.cartId && !parsed.data.anonymousId) {
    throw new ValidationError('Either cartId or anonymousId is required');
  }

  // Check availability before touching any cart.
  const available = await deps.variantRepo.getAvailableStock(
    deps.tenantId,
    parsed.data.variantId,
  );
  if (available < parsed.data.qty) {
    throw new InventoryError(
      `Only ${available} units available for variant ${parsed.data.variantId}`,
      { details: { variantId: parsed.data.variantId, requested: parsed.data.qty, available } },
    );
  }

  // Resolve price for the requested currency.
  const unitPrice = await deps.variantRepo.getPriceFor(
    deps.tenantId,
    parsed.data.variantId,
    { currency: deps.currency, channel: deps.channel ?? 'default' },
  );
  if (!unitPrice) {
    throw new NotFoundError(
      `No price found for variant ${parsed.data.variantId} in ${deps.currency}`,
      { details: { variantId: parsed.data.variantId, currency: deps.currency } },
    );
  }

  // Resolve or create the cart.
  let cart: Cart | null = null;
  if (parsed.data.cartId) {
    cart = await deps.cartRepo.findById(deps.tenantId, parsed.data.cartId);
    if (!cart) throw new NotFoundError(`Cart ${parsed.data.cartId} not found`);
  } else if (parsed.data.anonymousId) {
    cart = await deps.cartRepo.findActiveCart(deps.tenantId, {
      anonymousId: parsed.data.anonymousId,
      currency: deps.currency,
    });
    if (!cart) {
      cart = await deps.cartRepo.create(deps.tenantId, {
        currency: deps.currency,
        anonymousId: parsed.data.anonymousId,
      });
    }
  }
  if (!cart) throw new ValidationError('Unable to resolve cart');

  return deps.cartRepo.addItem(deps.tenantId, cart.id, {
    variantId: parsed.data.variantId,
    qty: parsed.data.qty,
    unitPrice,
  });
}
