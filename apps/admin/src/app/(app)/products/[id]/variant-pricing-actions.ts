'use server';

import { revalidatePath } from 'next/cache';
import type { PriceSet } from '@claudeshop/contracts/product';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error?.message ?? fallback;
}

export async function listVariantPrices(variantId: string): Promise<PriceSet[]> {
  const res = await adminFetch(
    `/v1/admin/variants/${encodeURIComponent(variantId)}/prices`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { data: PriceSet[] };
  return body.data;
}

export async function upsertVariantPriceAction(
  variantId: string,
  productId: string,
  formData: FormData,
): Promise<void> {
  const currency = (formData.get('currency') ?? '').toString().trim().toUpperCase();
  const amount = (formData.get('amount') ?? '').toString().trim();
  const channelRaw = (formData.get('channel') ?? '').toString().trim();
  const taxIncluded = formData.get('taxIncluded') === 'on';
  // Phase 54 — time-windowed pricing. HTML date inputs give us
  // YYYY-MM-DD; we expand to full-day ISO boundaries so an admin
  // picking "2026-12-01 → 2026-12-31" covers every hour of both
  // days. Empty strings → null (API treats as "no bound").
  const validFromRaw = (formData.get('validFrom') ?? '').toString().trim();
  const validToRaw = (formData.get('validTo') ?? '').toString().trim();
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(validFromRaw)
    ? `${validFromRaw}T00:00:00.000Z`
    : null;
  const validTo = /^\d{4}-\d{2}-\d{2}$/.test(validToRaw)
    ? `${validToRaw}T23:59:59.999Z`
    : null;

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Currency must be an ISO-4217 3-letter code (EUR, USD, GBP…).');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error('Amount must be a decimal like 29.00.');
  }
  if (validFrom && validTo && validFrom >= validTo) {
    throw new Error('Valid-from must be before valid-to.');
  }

  const body: Record<string, unknown> = {
    currency,
    amount,
    taxIncluded,
  };
  if (channelRaw.length > 0) body.channel = channelRaw;
  if (validFrom) body.validFrom = validFrom;
  if (validTo) body.validTo = validTo;

  const res = await adminFetch(
    `/v1/admin/variants/${encodeURIComponent(variantId)}/prices`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
  if (!res.ok) {
    throw new Error(await readError(res, `Save price failed (${res.status})`));
  }

  revalidatePath(`/products/${productId}`);
}

export async function deleteVariantPriceAction(
  variantId: string,
  productId: string,
  currency: string,
  channel: string,
): Promise<void> {
  const params = new URLSearchParams({
    currency: currency.toUpperCase(),
    channel,
  });
  const res = await adminFetch(
    `/v1/admin/variants/${encodeURIComponent(variantId)}/prices?${params.toString()}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    throw new Error(await readError(res, `Delete price failed (${res.status})`));
  }

  revalidatePath(`/products/${productId}`);
}
