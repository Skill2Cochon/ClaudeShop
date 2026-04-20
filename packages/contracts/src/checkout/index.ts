import { z } from 'zod';
import {
  CuidSchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
} from '../common/primitives';

const CountryCodeSchema = z.string().length(2).regex(/^[A-Z]{2}$/);

// --- Tax rates ----------------------------------------------------------

export const TaxRateSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  name: z.string().min(1).max(120),
  countryCode: CountryCodeSchema,
  regionCode: z.string().max(20).nullable(),
  postcodePattern: z.string().max(40).nullable(),
  /** Basis points: 0..10000 (0%..100%). 2000 = 20.00%. */
  rateBp: z.number().int().min(0).max(10_000),
  priority: z.number().int(),
  isActive: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type TaxRate = z.infer<typeof TaxRateSchema>;

export const CreateTaxRateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  countryCode: CountryCodeSchema,
  regionCode: z.string().max(20).optional(),
  postcodePattern: z.string().max(40).optional(),
  rateBp: z.number().int().min(0).max(10_000),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type CreateTaxRateInput = z.infer<typeof CreateTaxRateInputSchema>;

export const UpdateTaxRateInputSchema = CreateTaxRateInputSchema.partial();
export type UpdateTaxRateInput = z.infer<typeof UpdateTaxRateInputSchema>;

// --- Shipping rates -----------------------------------------------------

export const ShippingRateSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  name: z.string().min(1).max(120),
  countryCodes: z.array(CountryCodeSchema).min(1).max(250),
  currency: CurrencyCodeSchema,
  basePriceCents: z.number().int().min(0),
  minSubtotalCents: z.number().int().min(0).nullable(),
  freeShippingAboveCents: z.number().int().min(0).nullable(),
  estimatedDays: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ShippingRate = z.infer<typeof ShippingRateSchema>;

export const CreateShippingRateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  countryCodes: z.array(CountryCodeSchema).min(1).max(250),
  currency: CurrencyCodeSchema,
  basePriceCents: z.number().int().min(0),
  minSubtotalCents: z.number().int().min(0).optional(),
  freeShippingAboveCents: z.number().int().min(0).optional(),
  estimatedDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type CreateShippingRateInput = z.infer<typeof CreateShippingRateInputSchema>;

export const UpdateShippingRateInputSchema = CreateShippingRateInputSchema.partial();
export type UpdateShippingRateInput = z.infer<typeof UpdateShippingRateInputSchema>;
