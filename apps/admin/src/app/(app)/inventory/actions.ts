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

export async function adjustStockAction(
  variantId: string,
  formData: FormData,
): Promise<void> {
  const deltaRaw = (formData.get('delta') ?? '').toString();
  const reason = (formData.get('reason') ?? '').toString();
  const delta = Number.parseInt(deltaRaw, 10);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Delta must be a non-zero integer.');
  }

  const res = await adminFetch(`/v1/admin/inventory/adjust`, {
    method: 'POST',
    body: JSON.stringify({
      variantId,
      delta,
      ...(reason.length > 0 ? { reason } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, `Adjust failed (${res.status})`));
  }

  revalidatePath('/inventory');
}

export async function setSafetyStockAction(
  variantId: string,
  formData: FormData,
): Promise<void> {
  const raw = (formData.get('safetyStock') ?? '').toString();
  const safetyStock = Number.parseInt(raw, 10);
  if (!Number.isFinite(safetyStock) || safetyStock < 0) {
    throw new Error('Safety stock must be a non-negative integer.');
  }

  const res = await adminFetch(`/v1/admin/inventory/safety-stock`, {
    method: 'POST',
    body: JSON.stringify({ variantId, safetyStock }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, `Update failed (${res.status})`));
  }

  revalidatePath('/inventory');
}

/**
 * Phase 52 — fire the low-stock digest manually. When `to` is empty
 * the API falls back to settings.storefront.supportEmail. Throws on
 * failure so the form's error boundary surfaces a human message;
 * on success the result object (sent/rowCount/reason) is picked up
 * via the audit log — the button intentionally stays stateless.
 */
export async function sendLowStockDigestAction(
  formData: FormData,
): Promise<void> {
  const to = (formData.get('to') ?? '').toString().trim();
  const body: Record<string, unknown> = {};
  if (to.length > 0) body.to = to;

  const res = await adminFetch('/v1/admin/inventory/low-stock-digest', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      await readError(res, `Digest send failed (${res.status})`),
    );
  }

  revalidatePath('/inventory');
}
