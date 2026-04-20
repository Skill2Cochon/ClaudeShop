import { PlaceOrderInputSchema, type Order, type PlaceOrderInput } from '@claudeshop/contracts/order';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { CartRepository } from '../ports/cart-repository';
import type { InventoryRepository, StockReservation } from '../ports/inventory-repository';
import type { OrderRepository } from '../ports/order-repository';
import type { VariantRepository } from '../ports/variant-repository';
import type { ShippingRateRepository } from '../ports/shipping-rate-repository';
import type { TaxRateRepository } from '../ports/tax-rate-repository';
import type { PromotionRepository } from '../ports/promotion-repository';
import { SystemClock, type Clock } from '../ports/clock';
import { applyPromotion } from './apply-promotion';

export interface PlaceOrderDeps {
  tenantId: string;
  cartRepo: CartRepository;
  orderRepo: OrderRepository;
  /**
   * Used to enrich each order line with `productName` + `sku`.
   * Optional in Phase 2 — if omitted, lines get empty display strings.
   */
  variantRepo?: VariantRepository;
  /**
   * Atomically reserves stock before order creation. Optional — if omitted,
   * stock is NOT reserved (dev + legacy tests).
   */
  inventoryRepo?: InventoryRepository;
  /**
   * Phase 8.1 — when provided, the use-case applies the matching tax rate
   * to the subtotal based on the shippingAddress on the input. Optional;
   * absent repos = no tax applied.
   */
  taxRateRepo?: TaxRateRepository;
  /**
   * Phase 8.1 — when provided alongside shippingRateId on the input, the
   * use-case looks up the rate, validates currency/country, applies
   * freeShippingAbove, and stamps shipping on the order totals.
   */
  shippingRateRepo?: ShippingRateRepository;
  /** Prefix for generated order numbers (e.g. "CS" → "CS-000042"). */
  numberPrefix?: string;
  /**
   * Returns the next sequential order number for the tenant. Phase 2 uses a
   * deterministic counter in tests; Phase 2 prod uses a Postgres sequence
   * `tenant_order_seq` bumped in the same transaction.
   */
  sequence?: () => Promise<number>;
  /**
   * Phase 53 — when provided alongside `promotionCode` on the input, the
   * use case validates the code via applyPromotion, applies the discount
   * (and zeroes shipping for FREE_SHIPPING), then bumps the redemption
   * counter atomically after the order commits. Omit to disable the
   * feature entirely — existing tests stay green.
   */
  promotionRepo?: PromotionRepository;
  /** Clock for promotion eligibility checks. Defaults to Date.now(). */
  clock?: Clock;
}

/**
 * Place an order from an ACTIVE cart.
 *
 * Flow:
 * 1. Validate input via Zod.
 * 2. Load cart; assert ACTIVE status and non-empty items.
 * 3. For each cart item: enrich with {sku, productName} via VariantRepository
 *    (when provided) and compute per-line totals using BigInt cent math.
 * 4. Create the Order (status PENDING_PAYMENT) with all lines.
 * 5. Transition the cart to ORDERED (idempotent).
 *
 * Errors:
 * - ValidationError — input shape, empty cart, non-ACTIVE status
 * - NotFoundError   — cart does not exist in tenant scope
 *
 * Deferred to Phase 2.3+:
 * - Stock reservation (pending InventoryRepository)
 * - Idempotency-Key enforcement
 * - Payment intent creation (separate use-case)
 */
export async function placeOrder(
  input: PlaceOrderInput,
  deps: PlaceOrderDeps,
): Promise<Order> {
  const parsed = PlaceOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid placeOrder input', { details: parsed.error.issues });
  }

  const cart = await deps.cartRepo.findById(deps.tenantId, parsed.data.cartId);
  if (!cart) throw new NotFoundError(`Cart ${parsed.data.cartId} not found`);

  if (cart.status !== 'ACTIVE') {
    throw new ValidationError(`Cart is not ACTIVE (current status: ${cart.status})`);
  }

  if (cart.items.length === 0) {
    throw new ValidationError('Cannot place an order from an empty cart');
  }

  const reservations: StockReservation[] = collapseReservations(
    cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
  );

  if (deps.inventoryRepo) {
    await deps.inventoryRepo.reserveStock(deps.tenantId, reservations);
  }

  let order: Order;
  let appliedPromotionId: string | null = null;
  try {
    let subtotalCents = 0n;
    const lines = await Promise.all(
      cart.items.map(async (item) => {
        const summary = deps.variantRepo
          ? await deps.variantRepo.getSummary(deps.tenantId, item.variantId)
          : null;

        const unitCents = toCents(item.unitPrice);
        const lineSubtotalCents = unitCents * BigInt(item.qty);
        subtotalCents += lineSubtotalCents;

        return {
          variantId: item.variantId,
          productName: summary?.productName ?? '',
          sku: summary?.sku ?? '',
          qty: item.qty,
          unitPrice: item.unitPrice,
          subtotal: fromCents(lineSubtotalCents),
          tax: '0.00',
          discount: '0.00',
          total: fromCents(lineSubtotalCents),
        };
      }),
    );

    const subtotal = fromCents(subtotalCents);

    // Phase 8.1 — resolve shipping + tax from the optional inputs.
    let shippingCents = 0n;
    if (parsed.data.shippingRateId && deps.shippingRateRepo) {
      const rate = await deps.shippingRateRepo.findById(
        deps.tenantId,
        parsed.data.shippingRateId,
      );
      if (!rate) {
        throw new NotFoundError(
          `Shipping rate ${parsed.data.shippingRateId} not found`,
        );
      }
      if (!rate.isActive) {
        throw new ValidationError(
          `Shipping rate "${rate.name}" is inactive`,
        );
      }
      if (rate.currency !== cart.currency) {
        throw new ValidationError(
          `Shipping rate currency (${rate.currency}) does not match cart currency (${cart.currency})`,
        );
      }
      if (
        parsed.data.shippingAddress &&
        !rate.countryCodes.includes(parsed.data.shippingAddress.country)
      ) {
        throw new ValidationError(
          `Shipping rate "${rate.name}" does not ship to ${parsed.data.shippingAddress.country}`,
        );
      }
      const freeAbove = rate.freeShippingAboveCents;
      if (freeAbove !== null && Number(subtotalCents) >= freeAbove) {
        shippingCents = 0n;
      } else if (
        rate.minSubtotalCents !== null &&
        Number(subtotalCents) < rate.minSubtotalCents
      ) {
        throw new ValidationError(
          `Cart subtotal does not meet the minimum (${(rate.minSubtotalCents / 100).toFixed(2)} ${rate.currency}) for shipping rate "${rate.name}"`,
        );
      } else {
        shippingCents = BigInt(rate.basePriceCents);
      }
    }

    let taxCents = 0n;
    if (parsed.data.shippingAddress && deps.taxRateRepo) {
      const matches = await deps.taxRateRepo.findApplicable(deps.tenantId, {
        country: parsed.data.shippingAddress.country,
        ...(parsed.data.shippingAddress.region
          ? { region: parsed.data.shippingAddress.region }
          : {}),
        ...(parsed.data.shippingAddress.postcode
          ? { postcode: parsed.data.shippingAddress.postcode }
          : {}),
      });
      const winner = matches[0];
      if (winner) {
        // Tax applies to subtotal + shipping (standard EU/US convention).
        const taxableCents = subtotalCents + shippingCents;
        // Half-up basis-points rounding.
        taxCents = (taxableCents * BigInt(winner.rateBp) + 5_000n) / 10_000n;
      }
    }

    // Phase 53 — apply promotion code if both the input carries one and the
    // repo/clock pair is available. applyPromotion validates eligibility
    // (status, window, per-code redemption cap, subtotal floor) and
    // computes the discount in minor-unit BigInts. Failure surfaces as
    // the same Validation/NotFound error the use case already throws,
    // which rolls back the reservation via the outer catch.
    let discountCents = 0n;
    if (parsed.data.promotionCode && deps.promotionRepo) {
      const clock: Clock = deps.clock ?? new SystemClock();
      const applied = await applyPromotion(
        {
          code: parsed.data.promotionCode,
          subtotal,
          currency: cart.currency,
          shipping: fromCents(shippingCents),
        },
        {
          tenantId: deps.tenantId,
          repo: deps.promotionRepo,
          clock,
        },
      );

      // FREE_SHIPPING zeroes the shipping line; other types decrement the
      // subtotal discount bucket. We never let the discount drive a
      // negative total — applyPromotion already clamps at subtotal.
      if (applied.type === 'FREE_SHIPPING') {
        shippingCents = 0n;
      } else {
        discountCents = toCents(applied.discount);
      }
      appliedPromotionId = applied.promotionId;

      // Tax was already computed against the pre-discount taxable base.
      // Most jurisdictions tax on the post-discount amount, so recompute
      // when a tax repo was involved — otherwise we'd be over-collecting.
      if (taxCents > 0n && deps.taxRateRepo && parsed.data.shippingAddress) {
        const taxableAfterDiscount =
          subtotalCents - discountCents + shippingCents;
        // Reuse the already-resolved rate — no need to re-query the repo.
        const bp = (taxCents * 10_000n + (subtotalCents + shippingCents) / 2n) /
          (subtotalCents + shippingCents);
        taxCents =
          (taxableAfterDiscount * bp + 5_000n) / 10_000n;
      }
    }

    const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
    const totals = {
      subtotal,
      tax: fromCents(taxCents),
      discount: fromCents(discountCents),
      shipping: fromCents(shippingCents),
      total: fromCents(totalCents),
    };

    const seq = deps.sequence ? await deps.sequence() : Date.now() % 1_000_000;
    const numberPrefix = deps.numberPrefix ?? 'CS';
    const number = `${numberPrefix}-${String(seq).padStart(6, '0')}`;

    order = await deps.orderRepo.create(deps.tenantId, {
      tenantId: deps.tenantId,
      number,
      customerId: cart.customerId,
      anonymousEmail: parsed.data.customerEmail ?? null,
      status: 'PENDING_PAYMENT',
      currency: cart.currency,
      totals,
      lines: lines.map((l) => ({ ...l, id: '', orderId: '' })),
      placedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (deps.inventoryRepo) {
      try {
        await deps.inventoryRepo.releaseStock(deps.tenantId, reservations);
      } catch {
        // Non-fatal: reservation stays; cron sweeper reconciles in Phase 2.5.
      }
    }
    throw err;
  }

  await deps.cartRepo.markOrdered(deps.tenantId, cart.id);

  // Phase 53 — redeem the promotion after the order + cart transition
  // commit, best-effort. A redemption-counter hiccup must not roll back
  // the order; the max-redemption race is enforced inside the repo's
  // WHERE clause so concurrent checkouts still fail safely there.
  if (appliedPromotionId && deps.promotionRepo) {
    try {
      await deps.promotionRepo.incrementRedemption(
        deps.tenantId,
        appliedPromotionId,
      );
    } catch {
      // Intentionally swallowed — forensic record lives in the audit log
      // path (when the route wraps this call with recordFromRequest).
    }
  }

  return order;
}

function collapseReservations(entries: StockReservation[]): StockReservation[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.variantId, (map.get(entry.variantId) ?? 0) + entry.qty);
  }
  return [...map.entries()].map(([variantId, qty]) => ({ variantId, qty }));
}

/** 12.34 → 1234n ; -0.05 → -5n. Supports up to 4 fractional digits. */
function toCents(value: string): bigint {
  const [sign, rest] = value.startsWith('-') ? [-1n, value.slice(1)] : [1n, value];
  const [whole, frac = ''] = rest.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return sign * (BigInt(whole ?? '0') * 100n + BigInt(fracPadded || '0'));
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fracStr}`;
}
