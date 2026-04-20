import { z } from 'zod';
import {
  CuidSchema,
  SlugSchema,
  MoneySchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
} from '../common/primitives';
import { LocalizedRichTextSchema, LocalizedStringSchema } from '../common/i18n';

export const ProductStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const ProductTypeSchema = z.enum([
  'SIMPLE',
  'VARIABLE',
  'BUNDLE',
  'DIGITAL',
  'SUBSCRIPTION',
]);

export const VariantSchema = z.object({
  id: CuidSchema,
  productId: CuidSchema,
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).nullable(),
  options: z.record(z.string()).default({}),
  weight: MoneySchema.nullable(),
  /**
   * Active price for the requested currency (Phase 15). Populated when the
   * product was fetched with a `priceFor` query param; otherwise undefined.
   */
  price: z
    .object({
      amount: MoneySchema,
      currency: CurrencyCodeSchema,
    })
    .optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const PriceSetSchema = z.object({
  id: CuidSchema,
  variantId: CuidSchema,
  currency: CurrencyCodeSchema,
  amount: MoneySchema,
  channel: z.string().default('default'),
  validFrom: IsoDateTimeSchema.nullable(),
  validTo: IsoDateTimeSchema.nullable(),
  taxIncluded: z.boolean().default(false),
});

export const ProductSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  slug: SlugSchema,
  status: ProductStatusSchema,
  type: ProductTypeSchema,
  name: LocalizedStringSchema,
  description: LocalizedRichTextSchema.optional(),
  seo: z
    .object({
      title: LocalizedStringSchema.optional(),
      description: LocalizedStringSchema.optional(),
    })
    .optional(),
  variants: z.array(VariantSchema).default([]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateProductInputSchema = ProductSchema.pick({
  slug: true,
  status: true,
  type: true,
  name: true,
  description: true,
  seo: true,
}).extend({
  variants: z
    .array(
      VariantSchema.pick({ sku: true, barcode: true, options: true, weight: true }),
    )
    .min(1),
});

export const UpdateProductInputSchema = CreateProductInputSchema.partial();

export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type ProductType = z.infer<typeof ProductTypeSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type PriceSet = z.infer<typeof PriceSetSchema>;
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;
