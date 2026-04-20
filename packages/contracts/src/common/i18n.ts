import { z } from 'zod';
import { LocaleSchema } from './primitives';

/**
 * Localized string — a map from locale code to string.
 * Default locale must always be present.
 */
export const LocalizedStringSchema = z.record(LocaleSchema, z.string().min(1));
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;

export const LocalizedRichTextSchema = z.record(LocaleSchema, z.string());
export type LocalizedRichText = z.infer<typeof LocalizedRichTextSchema>;

/** Resolve a localized string to a concrete locale, with fallback. */
export function resolveLocalized(
  value: LocalizedString | undefined,
  locale: string,
  fallback: string = 'en',
): string {
  if (!value) return '';
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}
