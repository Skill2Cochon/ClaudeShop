import type {
  AIProvider,
  GenerateProductCopyInput,
  LocalizedProductCopy,
  ProductCopyResult,
} from '../ports/ai-provider';

/**
 * Deterministic StubAIProvider. Used in tests and in dev when no
 * ANTHROPIC_API_KEY is configured. Generates plausible-looking copy
 * without hitting any external API.
 *
 * This is NOT intended for production — real copy quality comes from
 * ClaudeAIProvider or another LLM adapter.
 */
export class StubAIProvider implements AIProvider {
  readonly name = 'stub';

  async generateProductCopy(input: GenerateProductCopyInput): Promise<ProductCopyResult> {
    const locales = (input.locales && input.locales.length > 0 ? input.locales : ['en']).slice(
      0,
      4,
    );
    const seed = input.seed.trim();
    const tone = input.tone ?? 'friendly';
    const attrs = input.attributes ?? {};

    const locCopies: LocalizedProductCopy[] = locales.map((locale) =>
      stubLocale(locale, seed, tone, attrs),
    );

    return {
      locales: locCopies,
      model: 'stub-deterministic',
      usage: {
        inputTokens: Math.ceil(seed.length / 4) * locales.length,
        outputTokens: 120 * locales.length,
      },
    };
  }
}

function stubLocale(
  locale: string,
  seed: string,
  tone: string,
  attrs: Record<string, string>,
): LocalizedProductCopy {
  const attrLine = Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const templates: Record<string, (seed: string, attr: string, tone: string) => LocalizedProductCopy> = {
    en: (s, a, t) => ({
      locale: 'en',
      name: titleCase(s),
      tagline: `The ${t} pick you'll reach for on repeat.`,
      description: `${titleCase(s)} — ${a || 'crafted with intent'}. Designed to feel right every day.`,
      seo: {
        title: `${titleCase(s)} · ClaudeShop`,
        description: `Shop ${s}. ${a || 'Premium, practical, timeless.'}`,
      },
    }),
    fr: (s, a, t) => ({
      locale: 'fr',
      name: titleCase(s),
      tagline: `Le choix ${t === 'premium' ? 'raffiné' : 'essentiel'} qui fera la différence.`,
      description: `${titleCase(s)} — ${a || 'pensé avec intention'}. Pensé pour se glisser naturellement dans votre quotidien.`,
      seo: {
        title: `${titleCase(s)} · ClaudeShop`,
        description: `Découvrez ${s}. ${a || 'Premium, pratique, intemporel.'}`,
      },
    }),
    de: (s, a) => ({
      locale: 'de',
      name: titleCase(s),
      tagline: 'Das Must-Have für jeden Tag.',
      description: `${titleCase(s)} — ${a || 'mit Bedacht gemacht'}. Entwickelt für den Alltag.`,
      seo: {
        title: `${titleCase(s)} · ClaudeShop`,
        description: `Jetzt kaufen: ${s}. ${a || 'Premium, praktisch, zeitlos.'}`,
      },
    }),
    es: (s, a) => ({
      locale: 'es',
      name: titleCase(s),
      tagline: 'La elección que volverás a elegir.',
      description: `${titleCase(s)} — ${a || 'pensado con intención'}. Hecho para sentirse bien cada día.`,
      seo: {
        title: `${titleCase(s)} · ClaudeShop`,
        description: `Compra ${s}. ${a || 'Premium, práctico, atemporal.'}`,
      },
    }),
  };

  const fn = templates[locale] ?? templates.en!;
  return fn(seed, attrLine, tone);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');
}
