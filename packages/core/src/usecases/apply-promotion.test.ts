import { describe, expect, it, beforeEach } from 'vitest';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@claudeshop/errors';
import type {
  CreatePromotionInput,
  Promotion,
  PromotionStatus,
  UpdatePromotionInput,
} from '@claudeshop/contracts/promotion';
import type { PromotionRepository } from '../ports/promotion-repository.js';
import type { Clock } from '../ports/clock.js';
import { applyPromotion } from './apply-promotion.js';

class InMemoryPromotionRepository implements PromotionRepository {
  private readonly promotions = new Map<string, Promotion>();
  private readonly codeIndex = new Map<string, string>();
  private counter = 0;

  seed(partial: Partial<Promotion> & { tenantId: string; code: string; type: Promotion['type'] }): Promotion {
    this.counter++;
    const now = new Date().toISOString();
    const p: Promotion = {
      id: `pm${String(this.counter).padStart(22, '0')}`,
      tenantId: partial.tenantId,
      code: partial.code,
      name: partial.name ?? partial.code,
      type: partial.type,
      value: partial.value ?? 0,
      status: partial.status ?? 'ACTIVE',
      currency: partial.currency ?? null,
      minSubtotalCents: partial.minSubtotalCents ?? null,
      startsAt: partial.startsAt ?? null,
      endsAt: partial.endsAt ?? null,
      maxRedemptions: partial.maxRedemptions ?? null,
      redemptionCount: partial.redemptionCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.promotions.set(p.id, p);
    this.codeIndex.set(`${p.tenantId}:${p.code}`, p.id);
    return p;
  }

  async findById(tenantId: string, id: string): Promise<Promotion | null> {
    const p = this.promotions.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Promotion | null> {
    const id = this.codeIndex.get(`${tenantId}:${code}`);
    return id ? (this.promotions.get(id) ?? null) : null;
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PromotionStatus },
  ): Promise<{ items: Promotion[]; total: number }> {
    const all = [...this.promotions.values()].filter(
      (p) => p.tenantId === tenantId && (!opts.status || p.status === opts.status),
    );
    return {
      items: all.slice((opts.page - 1) * opts.limit, opts.page * opts.limit),
      total: all.length,
    };
  }

  async create(tenantId: string, input: CreatePromotionInput): Promise<Promotion> {
    return this.seed({
      tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      value: input.value,
      status: input.status ?? 'ACTIVE',
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.minSubtotalCents !== undefined
        ? { minSubtotalCents: input.minSubtotalCents }
        : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.maxRedemptions !== undefined
        ? { maxRedemptions: input.maxRedemptions }
        : {}),
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdatePromotionInput,
  ): Promise<Promotion> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Promotion ${id}`);
    const updated: Promotion = { ...existing };
    if (input.code !== undefined) updated.code = input.code;
    if (input.name !== undefined) updated.name = input.name;
    if (input.type !== undefined) updated.type = input.type;
    if (input.value !== undefined) updated.value = input.value;
    if (input.status !== undefined) updated.status = input.status;
    if (input.currency !== undefined) updated.currency = input.currency;
    if (input.minSubtotalCents !== undefined)
      updated.minSubtotalCents = input.minSubtotalCents;
    if (input.startsAt !== undefined) updated.startsAt = input.startsAt;
    if (input.endsAt !== undefined) updated.endsAt = input.endsAt;
    if (input.maxRedemptions !== undefined) updated.maxRedemptions = input.maxRedemptions;
    updated.updatedAt = new Date().toISOString();
    this.promotions.set(id, updated);
    return updated;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    this.promotions.delete(id);
    this.codeIndex.delete(`${tenantId}:${existing.code}`);
  }

  async incrementRedemption(tenantId: string, id: string): Promise<Promotion> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Promotion ${id}`);
    if (
      existing.maxRedemptions !== null &&
      existing.redemptionCount >= existing.maxRedemptions
    ) {
      throw new ConflictError('Max redemptions reached');
    }
    const next = {
      ...existing,
      redemptionCount: existing.redemptionCount + 1,
      updatedAt: new Date().toISOString(),
    };
    this.promotions.set(id, next);
    return next;
  }
}

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

describe('applyPromotion use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let repo: InMemoryPromotionRepository;
  const clock = new FixedClock(new Date('2026-04-19T12:00:00.000Z'));

  beforeEach(() => {
    repo = new InMemoryPromotionRepository();
  });

  it('PERCENTAGE: computes discount as integer cents of subtotal', async () => {
    repo.seed({ tenantId, code: 'TEN', type: 'PERCENTAGE', value: 10 });
    const result = await applyPromotion(
      { code: 'TEN', subtotal: '100.00', currency: 'EUR' },
      { tenantId, repo, clock },
    );
    expect(result.type).toBe('PERCENTAGE');
    expect(result.discount).toBe('10.00');
    expect(result.shippingDiscount).toBe('0.00');
  });

  it('PERCENTAGE: rounds half up (13.57 * 10% = 1.36)', async () => {
    repo.seed({ tenantId, code: 'TEN', type: 'PERCENTAGE', value: 10 });
    const result = await applyPromotion(
      { code: 'TEN', subtotal: '13.57', currency: 'EUR' },
      { tenantId, repo, clock },
    );
    expect(result.discount).toBe('1.36');
  });

  it('FIXED_AMOUNT: applies the value as minor units when currency matches', async () => {
    repo.seed({
      tenantId,
      code: 'FIVE',
      type: 'FIXED_AMOUNT',
      value: 500,
      currency: 'EUR',
    });
    const result = await applyPromotion(
      { code: 'FIVE', subtotal: '20.00', currency: 'EUR' },
      { tenantId, repo, clock },
    );
    expect(result.discount).toBe('5.00');
  });

  it('FIXED_AMOUNT: discount capped at subtotal (never negative total)', async () => {
    repo.seed({
      tenantId,
      code: 'HUGE',
      type: 'FIXED_AMOUNT',
      value: 10_000,
      currency: 'EUR',
    });
    const result = await applyPromotion(
      { code: 'HUGE', subtotal: '20.00', currency: 'EUR' },
      { tenantId, repo, clock },
    );
    expect(result.discount).toBe('20.00');
  });

  it('FIXED_AMOUNT: rejects currency mismatch', async () => {
    repo.seed({
      tenantId,
      code: 'EUR5',
      type: 'FIXED_AMOUNT',
      value: 500,
      currency: 'EUR',
    });
    await expect(
      applyPromotion(
        { code: 'EUR5', subtotal: '20.00', currency: 'USD' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('FREE_SHIPPING: zeroes shipping, leaves subtotal alone', async () => {
    repo.seed({ tenantId, code: 'SHIP', type: 'FREE_SHIPPING', value: 0 });
    const result = await applyPromotion(
      { code: 'SHIP', subtotal: '50.00', currency: 'EUR', shipping: '7.50' },
      { tenantId, repo, clock },
    );
    expect(result.type).toBe('FREE_SHIPPING');
    expect(result.discount).toBe('0.00');
    expect(result.shippingDiscount).toBe('7.50');
  });

  it('rejects an unknown code with NotFoundError', async () => {
    await expect(
      applyPromotion(
        { code: 'NOPE', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects promotions that are not ACTIVE', async () => {
    repo.seed({ tenantId, code: 'OFF', type: 'PERCENTAGE', value: 10, status: 'DISABLED' });
    await expect(
      applyPromotion(
        { code: 'OFF', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects promotions before startsAt', async () => {
    repo.seed({
      tenantId,
      code: 'SOON',
      type: 'PERCENTAGE',
      value: 10,
      startsAt: '2027-01-01T00:00:00.000Z',
    });
    await expect(
      applyPromotion(
        { code: 'SOON', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects promotions after endsAt', async () => {
    repo.seed({
      tenantId,
      code: 'PAST',
      type: 'PERCENTAGE',
      value: 10,
      endsAt: '2026-01-01T00:00:00.000Z',
    });
    await expect(
      applyPromotion(
        { code: 'PAST', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('enforces minSubtotalCents', async () => {
    repo.seed({
      tenantId,
      code: 'MIN',
      type: 'PERCENTAGE',
      value: 10,
      minSubtotalCents: 5000,
    });
    await expect(
      applyPromotion(
        { code: 'MIN', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const ok = await applyPromotion(
      { code: 'MIN', subtotal: '50.00', currency: 'EUR' },
      { tenantId, repo, clock },
    );
    expect(ok.discount).toBe('5.00');
  });

  it('enforces maxRedemptions', async () => {
    repo.seed({
      tenantId,
      code: 'ONCE',
      type: 'PERCENTAGE',
      value: 10,
      maxRedemptions: 1,
      redemptionCount: 1,
    });
    await expect(
      applyPromotion(
        { code: 'ONCE', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid code shape via Zod', async () => {
    await expect(
      applyPromotion(
        { code: 'lowercase', subtotal: '10.00', currency: 'EUR' },
        { tenantId, repo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
