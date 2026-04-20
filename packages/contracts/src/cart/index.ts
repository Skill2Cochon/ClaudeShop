import { z } from 'zod';
import {
  CuidSchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
  MoneySchema,
} from '../common/primitives.js';

export const CartStatusSchema = z.enum(['ACTIVE', 'ORDERED', 'ABANDONED', 'EXPIRED']);
export type CartStatus = z.infer<typeof CartStatusSchema>;

export const CartItemSchema = z.object({
  id: CuidSchema,
  cartId: CuidSchema,
  variantId: CuidSchema,
  qty: z.number().int().min(1),
  unitPrice: MoneySchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  customerId: CuidSchema.nullable(),
  anonymousId: z.string().min(8).max(64).nullable(),
  currency: CurrencyCodeSchema,
  status: CartStatusSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  items: z.array(CartItemSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Cart = z.infer<typeof CartSchema>;

export const AddToCartInputSchema = z.object({
  cartId: CuidSchema.optional(),
  anonymousId: z.string().min(8).max(64).optional(),
  variantId: CuidSchema,
  qty: z.number().int().min(1).max(999),
});
export type AddToCartInput = z.infer<typeof AddToCartInputSchema>;

export const UpdateCartItemInputSchema = z.object({
  cartId: CuidSchema,
  itemId: CuidSchema,
  qty: z.number().int().min(0).max(999),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInputSchema>;
