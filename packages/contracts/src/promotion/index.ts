import { z } from 'zod';
import {
  CurrencyCodeSchema,
  CuidSchema,
  IsoDateTimeSchema,
  MoneySchema,
} from '../common/primitives';

export const PromotionTypeSchema = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING',
]);
export type PromotionType = z.infer<typeof PromotionTypeSchema>;

export const PromotionStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'DISABLED',
  'EXPIRED',
]);
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;

export const PromotionCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, 'code must be uppercase letters, digits, or hyphens');

export const PromotionSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  code: PromotionCodeSchema,
  name: z.string().min(1).max(120),
  type: PromotionTypeSchema,
  /**
   * PERCENTAGE: 1..100, FIXED_AMOUNT: money in minor units, FREE_SHIPPING: ignored.
   */
  value: z.number().int().min(0),
  status: PromotionStatusSchema,
  currency: CurrencyCodeSchema.nullable(),
  minSubtotalCents: z.number().int().min(0).nullable(),
  startsAt: IsoDateTimeSchema.nullable(),
  endsAt: IsoDateTimeSchema.nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  redemptionCount: z.number().int().min(0),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Promotion = z.infer<typeof PromotionSchema>;

export const CreatePromotionInputSchema = PromotionSchema.pick({
  code: true,
  name: true,
  type: true,
  value: true,
  status: true,
  currency: true,
  minSubtotalCents: true,
  startsAt: true,
  endsAt: true,
  maxRedemptions: true,
}).extend({
  currency: CurrencyCodeSchema.nullable().optional(),
  minSubtotalCents: z.number().int().min(0).nullable().optional(),
  startsAt: IsoDateTimeSchema.nullable().optional(),
  endsAt: IsoDateTimeSchema.nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  status: PromotionStatusSchema.optional(),
});
export type CreatePromotionInput = z.infer<typeof CreatePromotionInputSchema>;

export const UpdatePromotionInputSchema = CreatePromotionInputSchema.partial();
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionInputSchema>;

export const ApplyPromotionInputSchema = z.object({
  code: PromotionCodeSchema,
  subtotal: MoneySchema,
  currency: CurrencyCodeSchema,
  shipping: MoneySchema.optional(),
});
export type ApplyPromotionInput = z.infer<typeof ApplyPromotionInputSchema>;

export const AppliedPromotionSchema = z.object({
  promotionId: CuidSchema,
  code: PromotionCodeSchema,
  type: PromotionTypeSchema,
  discount: MoneySchema,
  shippingDiscount: MoneySchema.default('0'),
  currency: CurrencyCodeSchema,
  summary: z.string(),
});
export type AppliedPromotion = z.infer<typeof AppliedPromotionSchema>;
