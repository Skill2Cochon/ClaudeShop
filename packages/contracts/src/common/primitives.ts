import { z } from 'zod';

/** Reusable primitive schemas — composed by every entity. */

export const CuidSchema = z.string().min(24).max(30);
export const UlidSchema = z.string().length(26);
export const UuidSchema = z.string().uuid();
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case');
export const EmailSchema = z.string().email().max(320).toLowerCase();
export const UrlSchema = z.string().url().max(2048);
export const MoneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'decimal with up to 4 fractional digits');
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'ISO 4217');
export const CountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2');
export const LocaleSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'BCP 47 (e.g. "fr" or "fr-FR")');

export type Cuid = z.infer<typeof CuidSchema>;
export type Slug = z.infer<typeof SlugSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type CountryCode = z.infer<typeof CountryCodeSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
