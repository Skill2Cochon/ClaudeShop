'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error?.message ?? fallback;
}

/**
 * Parse a "locale: value" multiline input into the { locale: value } map the
 * API expects for localised fields.
 * Lines without a colon are silently ignored so merchants can scribble
 * draft lines without breaking the submit.
 */
function parseLocalizedBlock(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^\s*([a-z]{2}(?:-[A-Z]{2})?)\s*:\s*(.+)$/);
    if (!match) continue;
    out[match[1]!] = match[2]!.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<void> {
  const slug = (formData.get('slug') ?? '').toString().trim();
  const status = (formData.get('status') ?? '').toString();
  const type = (formData.get('type') ?? '').toString();
  const name = parseLocalizedBlock((formData.get('name') ?? '').toString());
  const description = parseLocalizedBlock(
    (formData.get('description') ?? '').toString(),
  );
  const seoTitle = parseLocalizedBlock((formData.get('seoTitle') ?? '').toString());
  const seoDescription = parseLocalizedBlock(
    (formData.get('seoDescription') ?? '').toString(),
  );

  const body: Record<string, unknown> = {};
  if (slug.length > 0) body.slug = slug;
  if (status === 'DRAFT' || status === 'ACTIVE' || status === 'ARCHIVED') {
    body.status = status;
  }
  if (type === 'SIMPLE' || type === 'VARIABLE' || type === 'BUNDLE' || type === 'DIGITAL' || type === 'SUBSCRIPTION') {
    body.type = type;
  }
  if (name) body.name = name;
  if (description) body.description = description;
  if (seoTitle || seoDescription) {
    body.seo = {
      ...(seoTitle ? { title: seoTitle } : {}),
      ...(seoDescription ? { description: seoDescription } : {}),
    };
  }

  if (Object.keys(body).length === 0) {
    throw new Error('Nothing to update — every field was blank.');
  }

  const res = await adminFetch(`/v1/admin/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Update failed (${res.status})`));
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath('/products');
}

export async function archiveProductAction(productId: string): Promise<void> {
  const res = await adminFetch(
    `/v1/admin/products/${encodeURIComponent(productId)}/archive`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(await readError(res, `Archive failed (${res.status})`));
  }
  revalidatePath(`/products/${productId}`);
  revalidatePath('/products');
}
