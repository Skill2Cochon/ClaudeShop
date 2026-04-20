export const LOCALES = ['en', 'fr', 'de', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function resolveLocalized(
  value: Record<string, string> | undefined,
  locale: string,
  fallback: string = 'en',
): string {
  if (!value) return '';
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

export function formatPrice(
  amount: string | number,
  currency: string,
  locale: string,
): string {
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(num)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}
