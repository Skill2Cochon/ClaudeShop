import type {
  CreatePromotionInput,
  Promotion,
  PromotionStatus,
  UpdatePromotionInput,
} from '@claudeshop/contracts/promotion';

export interface PromotionRepository {
  findById(tenantId: string, id: string): Promise<Promotion | null>;
  findByCode(tenantId: string, code: string): Promise<Promotion | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PromotionStatus },
  ): Promise<{ items: Promotion[]; total: number }>;
  create(tenantId: string, input: CreatePromotionInput): Promise<Promotion>;
  update(tenantId: string, id: string, input: UpdatePromotionInput): Promise<Promotion>;
  delete(tenantId: string, id: string): Promise<void>;
  /**
   * Atomic increment of redemptionCount — called after a successful checkout.
   * Returns the updated promotion, or throws if the increment would exceed
   * maxRedemptions (race-condition-safe via WHERE clause).
   */
  incrementRedemption(tenantId: string, id: string): Promise<Promotion>;
}
