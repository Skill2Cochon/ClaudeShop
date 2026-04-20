import {
  ApplyPromotionInputSchema,
  type AppliedPromotion,
  type ApplyPromotionInput,
  type Promotion,
} from '@claudeshop/contracts/promotion';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { PromotionRepository } from '../ports/promotion-repository';
import type { Clock } from '../ports/clock';

export interface ApplyPromotionDeps {
  tenantId: string;
  repo: PromotionRepository;
  clock: Clock;
}

/**
 * Validate a promotion code against the runtime context (subtotal, currency,
 * optional shipping) and compute the discount. Does NOT mutate the promotion —
 * redemption counting happens inside placeOrder after the order is persisted.
 *
 * Money math uses minor-unit BigInt to avoid float drift and match the
 * pattern used by placeOrder.
 */
export async function applyPromotion(
  input: ApplyPromotionInput,
  deps: ApplyPromotionDeps,
): Promise<AppliedPromotion> {
  const parsed = ApplyPromotionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid promotion input', {
      details: parsed.error.issues,
    });
  }

  const promotion = await deps.repo.findByCode(deps.tenantId, parsed.data.code);
  if (!promotion) {
    throw new NotFoundError(`Promotion "${parsed.data.code}" not found`);
  }

  ensureEligible(promotion, parsed.data, deps.clock.now());

  const subtotalCents = toCents(parsed.data.subtotal);
  const shippingCents = parsed.data.shipping ? toCents(parsed.data.shipping) : 0n;

  let discountCents = 0n;
  let shippingDiscountCents = 0n;

  switch (promotion.type) {
    case 'PERCENTAGE': {
      if (promotion.value < 1 || promotion.value > 100) {
        throw new ValidationError('PERCENTAGE promotions must have a value between 1 and 100');
      }
      // Half-up rounding via +50 before integer divide by 100.
      discountCents = (subtotalCents * BigInt(promotion.value) + 50n) / 100n;
      if (discountCents > subtotalCents) discountCents = subtotalCents;
      break;
    }
    case 'FIXED_AMOUNT': {
      if (!promotion.currency || promotion.currency !== parsed.data.currency) {
        throw new ValidationError(
          `FIXED_AMOUNT promotion "${promotion.code}" is denominated in ${
            promotion.currency ?? '(none)'
          }, cart is in ${parsed.data.currency}`,
        );
      }
      discountCents = BigInt(promotion.value);
      if (discountCents > subtotalCents) discountCents = subtotalCents;
      break;
    }
    case 'FREE_SHIPPING': {
      shippingDiscountCents = shippingCents;
      break;
    }
  }

  return {
    promotionId: promotion.id,
    code: promotion.code,
    type: promotion.type,
    discount: fromCents(discountCents),
    shippingDiscount: fromCents(shippingDiscountCents),
    currency: parsed.data.currency,
    summary: buildSummary(promotion, discountCents, shippingDiscountCents),
  };
}

function ensureEligible(
  promotion: Promotion,
  input: ApplyPromotionInput,
  now: Date,
): void {
  if (promotion.status !== 'ACTIVE') {
    throw new ValidationError(`Promotion "${promotion.code}" is ${promotion.status.toLowerCase()}`);
  }
  if (promotion.startsAt && new Date(promotion.startsAt).getTime() > now.getTime()) {
    throw new ValidationError(`Promotion "${promotion.code}" is not active yet`);
  }
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < now.getTime()) {
    throw new ValidationError(`Promotion "${promotion.code}" has expired`);
  }
  if (promotion.minSubtotalCents) {
    const subtotalCents = toCents(input.subtotal);
    if (subtotalCents < BigInt(promotion.minSubtotalCents)) {
      throw new ValidationError(
        `Cart subtotal must be at least ${(promotion.minSubtotalCents / 100).toFixed(2)} ${input.currency}`,
      );
    }
  }
  if (
    promotion.maxRedemptions !== null &&
    promotion.redemptionCount >= promotion.maxRedemptions
  ) {
    throw new ValidationError(`Promotion "${promotion.code}" is fully redeemed`);
  }
}

function toCents(money: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(money.trim());
  if (!match) throw new Error(`Invalid money value: "${money}"`);
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fractional = BigInt((match[3] ?? '').padEnd(2, '0'));
  return sign * (whole * 100n + fractional);
}

function fromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const fractional = abs % 100n;
  return `${sign}${whole.toString()}.${fractional.toString().padStart(2, '0')}`;
}

function buildSummary(
  promotion: Promotion,
  discountCents: bigint,
  shippingDiscountCents: bigint,
): string {
  if (promotion.type === 'PERCENTAGE') {
    return `${promotion.value}% off (-${fromCents(discountCents)})`;
  }
  if (promotion.type === 'FIXED_AMOUNT') {
    return `${fromCents(BigInt(promotion.value))} ${promotion.currency ?? ''} off`.trim();
  }
  return `Free shipping (-${fromCents(shippingDiscountCents)})`;
}
