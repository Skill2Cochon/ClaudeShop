import { z } from 'zod';
import {
  CreateProductInputSchema,
  type CreateProductInput,
  type Product,
} from '@claudeshop/contracts/product';
import { ValidationError, ConflictError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository.js';
import type { Clock } from '../ports/clock.js';
import { createProduct } from './create-product.js';

export const ImportProductsBatchInputSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(500),
  /** `skip` (default) ignores slugs that already exist; `fail` aborts the whole batch. */
  mode: z.enum(['skip', 'fail']).optional(),
});
export type ImportProductsBatchInput = z.infer<typeof ImportProductsBatchInputSchema>;

export interface ImportProductsBatchDeps {
  tenantId: string;
  repo: ProductRepository;
  clock: Clock;
}

export type RowResult =
  | { status: 'created'; slug: string; productId: string }
  | { status: 'skipped'; slug: string; reason: string }
  | { status: 'error'; slug?: string; message: string; rowIndex: number };

export interface ImportProductsBatchResult {
  created: number;
  skipped: number;
  errored: number;
  total: number;
  rows: RowResult[];
}

/**
 * Import many products in one shot. Per-row failures do NOT abort the batch
 * by default — the caller gets a full result set and can retry only the
 * failing rows. Switch to `mode: 'fail'` to turn the first error into an
 * exception (useful for CI seeding that MUST be all-or-nothing).
 *
 * Contract:
 *  - Each row is Zod-validated against CreateProductInputSchema; invalid
 *    rows become { status: 'error', rowIndex, message }.
 *  - Slug collisions surface as { status: 'skipped' } in skip-mode or
 *    throw ConflictError in fail-mode.
 *  - The caller is responsible for tenant resolution + auth; the use-case
 *    only knows about tenantId.
 */
export async function importProductsBatch(
  input: ImportProductsBatchInput,
  deps: ImportProductsBatchDeps,
): Promise<ImportProductsBatchResult> {
  const parsed = ImportProductsBatchInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid import input', {
      details: parsed.error.issues,
    });
  }

  const mode = parsed.data.mode ?? 'skip';
  const rows: RowResult[] = [];
  let created = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i];
    const rowParse = CreateProductInputSchema.safeParse(raw);

    if (!rowParse.success) {
      const message = rowParse.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      rows.push({ status: 'error', message, rowIndex: i });
      errored++;
      if (mode === 'fail') {
        throw new ValidationError(`Row ${i} invalid: ${message}`, {
          details: { rowIndex: i, issues: rowParse.error.issues },
        });
      }
      continue;
    }

    const candidate: CreateProductInput = rowParse.data;

    try {
      const product = await createProduct(candidate, {
        tenantId: deps.tenantId,
        repo: deps.repo,
        clock: deps.clock,
      });
      rows.push({
        status: 'created',
        slug: (product as Product).slug,
        productId: (product as Product).id,
      });
      created++;
    } catch (err) {
      if (err instanceof ConflictError) {
        if (mode === 'skip') {
          rows.push({
            status: 'skipped',
            slug: candidate.slug,
            reason: 'slug already exists',
          });
          skipped++;
          continue;
        }
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      rows.push({
        status: 'error',
        slug: candidate.slug,
        message,
        rowIndex: i,
      });
      errored++;
      if (mode === 'fail') throw err;
    }
  }

  return { created, skipped, errored, total: parsed.data.rows.length, rows };
}
