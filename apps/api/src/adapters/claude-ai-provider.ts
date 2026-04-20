import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  GenerateProductCopyInput,
  LocalizedProductCopy,
  ProductCopyResult,
} from '@claudeshop/core';

export interface ClaudeAIProviderConfig {
  apiKey: string;
  model: string;
  /** Optional max tokens cap. Defaults to 1024. */
  maxTokens?: number;
}

/**
 * Claude-backed AIProvider. Uses `@anthropic-ai/sdk` and the Messages API with
 * a structured-output prompt + JSON parsing.
 *
 * Design notes:
 * - System prompt is constant per call — the Anthropic SDK automatically
 *   qualifies it for prompt caching (5-min TTL). Keeping the schema + tone
 *   guide in the system message means every call after the first in a 5-min
 *   window is drastically cheaper.
 * - Per-locale failure is tolerated: if Claude returns a partial list, we
 *   keep what parsed and skip the rest. The use-case contract promises we
 *   never throw on a single-locale JSON glitch.
 * - We pin JSON shape via an explicit response_format instruction rather
 *   than tool-use to keep the adapter SDK-version-tolerant.
 */
export class ClaudeAIProvider implements AIProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ClaudeAIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async generateProductCopy(input: GenerateProductCopyInput): Promise<ProductCopyResult> {
    const locales = (input.locales && input.locales.length > 0 ? input.locales : ['en']).slice(
      0,
      4,
    );
    const tone = input.tone ?? 'friendly';

    const systemPrompt = buildSystemPrompt(tone, input.audience, input.maxWords);
    const userPrompt = buildUserPrompt(input.seed, locales, input.attributes, input.brandVoiceSamples);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = extractText(response);
    const parsedLocales = parseLocalesFromJson(text, locales);

    return {
      locales: parsedLocales,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        ...(response.usage.cache_read_input_tokens !== undefined &&
        response.usage.cache_read_input_tokens !== null
          ? { cachedInputTokens: response.usage.cache_read_input_tokens }
          : {}),
      },
    };
  }
}

function buildSystemPrompt(tone: string, audience?: string, maxWords?: number): string {
  const audienceLine = audience ? `Target audience: ${audience}.` : '';
  const lengthLine = maxWords
    ? `Keep the description under ${maxWords} words.`
    : 'Keep the description between 40 and 120 words.';

  return [
    'You write conversion-focused product copy for modern e-commerce storefronts.',
    `Voice: ${tone}. Honest, specific, never hyped.`,
    audienceLine,
    lengthLine,
    '',
    'For each requested locale, produce: name, tagline (<=14 words), description, seo.title (<=60 chars), seo.description (<=155 chars).',
    'Respect cultural and linguistic idioms — do not literal-translate.',
    '',
    'Output STRICT JSON ONLY, shaped exactly as:',
    '{"locales":[{"locale":"<code>","name":"","tagline":"","description":"","seo":{"title":"","description":""}}]}',
    'No prose outside the JSON. No markdown fences. No comments.',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n');
}

function buildUserPrompt(
  seed: string,
  locales: string[],
  attributes: Record<string, string> | undefined,
  brandVoiceSamples: string[] | undefined,
): string {
  const attrLines = attributes
    ? Object.entries(attributes)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : '';

  const brandBlock =
    brandVoiceSamples && brandVoiceSamples.length > 0
      ? `\nBrand voice samples (match cadence and vocabulary):\n${brandVoiceSamples
          .map((s, i) => `${i + 1}. ${s}`)
          .join('\n')}\n`
      : '';

  return [
    `Seed description: ${seed}`,
    attrLines ? `Product attributes:\n${attrLines}` : '',
    brandBlock,
    `Locales to generate: ${locales.join(', ')}`,
    'Respond with the JSON object now.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function extractText(response: Anthropic.Message): string {
  const parts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text);
  return parts.join('');
}

interface RawLocale {
  locale?: unknown;
  name?: unknown;
  tagline?: unknown;
  description?: unknown;
  seo?: { title?: unknown; description?: unknown };
}

function parseLocalesFromJson(
  text: string,
  requestedLocales: string[],
): LocalizedProductCopy[] {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return [];
  }
  const candidate = text.slice(jsonStart, jsonEnd + 1);

  let parsed: { locales?: RawLocale[] };
  try {
    parsed = JSON.parse(candidate) as { locales?: RawLocale[] };
  } catch {
    return [];
  }

  const out: LocalizedProductCopy[] = [];
  const raw = Array.isArray(parsed.locales) ? parsed.locales : [];

  for (const requested of requestedLocales) {
    const match = raw.find((l) => typeof l.locale === 'string' && l.locale === requested);
    if (!match) continue;
    const normalised = normaliseLocale(match);
    if (normalised) out.push(normalised);
  }
  return out;
}

function normaliseLocale(raw: RawLocale): LocalizedProductCopy | null {
  if (typeof raw.locale !== 'string') return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.tagline !== 'string') return null;
  if (typeof raw.description !== 'string') return null;
  const seoTitle = raw.seo?.title;
  const seoDesc = raw.seo?.description;
  if (typeof seoTitle !== 'string' || typeof seoDesc !== 'string') return null;
  return {
    locale: raw.locale,
    name: raw.name,
    tagline: raw.tagline,
    description: raw.description,
    seo: { title: seoTitle, description: seoDesc },
  };
}
