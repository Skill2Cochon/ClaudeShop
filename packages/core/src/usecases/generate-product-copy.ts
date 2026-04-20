import { z } from 'zod';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type {
  AIProvider,
  GenerateProductCopyInput,
  ProductCopyResult,
} from '../ports/ai-provider';

/**
 * Input contract for the `generateProductCopy` use-case.
 *
 * Kept intentionally narrower than `GenerateProductCopyInput` — the use-case
 * enriches the AI call with attributes derived from the product, so callers
 * only supply the merchant-facing knobs.
 */
export const GenerateProductCopyUseCaseInputSchema = z.object({
  productId: z.string().min(1),
  seed: z.string().trim().min(1, 'seed must not be empty'),
  tone: z
    .enum(['friendly', 'premium', 'technical', 'playful', 'minimal'])
    .optional(),
  audience: z.string().optional(),
  maxWords: z.number().int().positive().max(400).optional(),
  locales: z.array(z.string().min(2).max(10)).optional(),
  brandVoiceSamples: z.array(z.string()).optional(),
});

export type GenerateProductCopyUseCaseInput = z.infer<
  typeof GenerateProductCopyUseCaseInputSchema
>;

export interface GenerateProductCopyDeps {
  tenantId: string;
  productRepo: ProductRepository;
  ai: AIProvider;
}

const MAX_LOCALES = 4;
const DEFAULT_LOCALES = ['en'] as const;

/**
 * Generate merchant-facing product copy (name, tagline, description, SEO) in
 * multiple locales for an existing product.
 *
 * Contract:
 * - Input is Zod-validated; invalid shapes throw ValidationError.
 * - Product must exist in the current tenant; otherwise NotFoundError.
 * - Locales are capped at MAX_LOCALES to protect token budget.
 * - Variant option values are surfaced as attribute hints to the AI provider,
 *   so tone-appropriate phrasing reflects concrete product dimensions.
 * - The underlying AIProvider is responsible for deterministic fallback on
 *   partial locale failure — this use-case does not retry.
 */
export async function generateProductCopy(
  input: GenerateProductCopyUseCaseInput,
  deps: GenerateProductCopyDeps,
): Promise<ProductCopyResult> {
  const parsed = GenerateProductCopyUseCaseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid generateProductCopy input', {
      details: parsed.error.issues,
    });
  }

  const product = await deps.productRepo.findById(deps.tenantId, parsed.data.productId);
  if (!product) {
    throw new NotFoundError(`Product ${parsed.data.productId} not found`, {
      details: { productId: parsed.data.productId, tenantId: deps.tenantId },
    });
  }

  const locales = (parsed.data.locales ?? [...DEFAULT_LOCALES]).slice(0, MAX_LOCALES);
  const attributes = collectAttributes(product.variants);

  const aiInput: GenerateProductCopyInput = {
    seed: parsed.data.seed,
    locales,
    attributes,
    ...(parsed.data.tone !== undefined ? { tone: parsed.data.tone } : {}),
    ...(parsed.data.audience !== undefined ? { audience: parsed.data.audience } : {}),
    ...(parsed.data.maxWords !== undefined ? { maxWords: parsed.data.maxWords } : {}),
    ...(parsed.data.brandVoiceSamples !== undefined
      ? { brandVoiceSamples: parsed.data.brandVoiceSamples }
      : {}),
  };

  return deps.ai.generateProductCopy(aiInput);
}

/** Flatten variant options into a single attribute map (first occurrence wins). */
function collectAttributes(
  variants: ReadonlyArray<{ options: Record<string, string> }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.options)) {
      if (out[key] === undefined) {
        out[key] = value;
      }
    }
  }
  return out;
}
