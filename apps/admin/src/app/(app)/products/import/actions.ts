'use server';

import { revalidatePath } from 'next/cache';
import { parseCsv } from '@claudeshop/core';
import type { ImportProductsBatchResult } from '@claudeshop/core';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; result: ImportProductsBatchResult };

/**
 * Take a pasted payload, split into per-slug product rows, and POST the batch
 * to the API. CSV mode is multi-row-per-product: rows with the same `slug`
 * are grouped and their variant columns feed the product's `variants[]`.
 * JSON mode expects the array shape `CreateProductInput[]` directly.
 */
export async function importProductsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const format = (formData.get('format') ?? 'csv').toString();
  const mode = (formData.get('mode') ?? 'skip').toString();
  const payload = (formData.get('payload') ?? '').toString();

  if (payload.trim().length === 0) {
    return { status: 'error', message: 'Paste a CSV or JSON payload first.' };
  }

  let rows: unknown[];
  try {
    rows = format === 'json' ? fromJson(payload) : fromCsv(payload);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (rows.length === 0) {
    return { status: 'error', message: 'No rows found in the payload.' };
  }

  const res = await adminFetch('/v1/admin/products/import', {
    method: 'POST',
    body: JSON.stringify({ rows, mode: mode === 'fail' ? 'fail' : 'skip' }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Import failed (${res.status})`,
    };
  }

  const body = (await res.json()) as { data: ImportProductsBatchResult };
  revalidatePath('/products');
  return { status: 'ok', result: body.data };
}

function fromJson(raw: string): unknown[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON payload must be an array of products.');
  }
  return parsed;
}

interface CsvRow {
  slug: string;
  name_en?: string;
  name_fr?: string;
  name_de?: string;
  name_es?: string;
  status?: string;
  type?: string;
  description_en?: string;
  description_fr?: string;
  sku: string;
  barcode?: string;
  size?: string;
  color?: string;
  material?: string;
  weight?: string;
  [key: string]: string | undefined;
}

/**
 * Multi-row CSV → CreateProductInput[]. Rows are grouped by `slug`; every
 * row contributes one variant. Recognised attribute columns (size, color,
 * material) are projected into variant.options. Unknown columns are ignored
 * silently so merchant exports don't need to be hand-trimmed.
 */
function fromCsv(raw: string): unknown[] {
  const parsed = parseCsv(raw) as CsvRow[];
  if (parsed.length === 0) return [];

  const bySlug = new Map<string, ReturnType<typeof emptyProduct>>();
  for (const row of parsed) {
    const slug = (row.slug ?? '').trim();
    if (slug.length === 0) continue;

    let product = bySlug.get(slug);
    if (!product) {
      product = emptyProduct(slug, row);
      bySlug.set(slug, product);
    }

    const options: Record<string, string> = {};
    if (row.size) options.size = row.size;
    if (row.color) options.color = row.color;
    if (row.material) options.material = row.material;

    product.variants.push({
      sku: row.sku,
      barcode: row.barcode ? row.barcode : null,
      options,
      weight: row.weight ? row.weight : null,
    });
  }

  return [...bySlug.values()];
}

function emptyProduct(slug: string, row: CsvRow) {
  const name: Record<string, string> = {};
  if (row.name_en) name.en = row.name_en;
  if (row.name_fr) name.fr = row.name_fr;
  if (row.name_de) name.de = row.name_de;
  if (row.name_es) name.es = row.name_es;

  const description: Record<string, string> = {};
  if (row.description_en) description.en = row.description_en;
  if (row.description_fr) description.fr = row.description_fr;

  return {
    slug,
    status: (row.status ?? 'DRAFT').toUpperCase(),
    type: (row.type ?? 'SIMPLE').toUpperCase(),
    name,
    ...(Object.keys(description).length > 0 ? { description } : {}),
    variants: [] as Array<{
      sku: string;
      barcode: string | null;
      options: Record<string, string>;
      weight: string | null;
    }>,
  };
}
