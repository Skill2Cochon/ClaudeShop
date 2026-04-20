'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface POFormState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

interface LineInput {
  variantId: string;
  sku: string;
  qtyOrdered: number;
  unitCost: string;
}

function parseLines(raw: FormDataEntryValue | null): LineInput[] | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: LineInput[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) return null;
      const obj = item as Record<string, unknown>;
      if (
        typeof obj.variantId !== 'string' ||
        typeof obj.sku !== 'string' ||
        typeof obj.qtyOrdered !== 'number' ||
        typeof obj.unitCost !== 'string'
      ) {
        return null;
      }
      out.push({
        variantId: obj.variantId,
        sku: obj.sku,
        qtyOrdered: obj.qtyOrdered,
        unitCost: obj.unitCost,
      });
    }
    return out;
  } catch {
    return null;
  }
}

export async function createPurchaseOrderAction(
  _prev: POFormState,
  formData: FormData,
): Promise<POFormState> {
  const supplierId = (formData.get('supplierId') ?? '').toString().trim();
  const currency = (formData.get('currency') ?? '').toString().trim().toUpperCase();
  const expectedAtRaw = (formData.get('expectedAt') ?? '').toString().trim();
  const notes = (formData.get('notes') ?? '').toString().trim();
  const linesParsed = parseLines(formData.get('lines'));

  if (!supplierId) return { status: 'error', message: 'Pick a supplier.' };
  if (!currency || currency.length !== 3) {
    return { status: 'error', message: 'Currency must be a 3-letter ISO code.' };
  }
  if (!linesParsed || linesParsed.length === 0) {
    return {
      status: 'error',
      message: 'Lines must be a JSON array with variantId, sku, qtyOrdered, unitCost.',
    };
  }

  const expectedAt = expectedAtRaw ? new Date(expectedAtRaw).toISOString() : undefined;

  const res = await adminFetch('/v1/admin/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({
      supplierId,
      currency,
      lines: linesParsed,
      ...(expectedAt ? { expectedAt } : {}),
      ...(notes ? { notes } : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Failed to create (${res.status})`,
    };
  }
  const data = (await res.json()) as { data: { id: string } };
  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${data.data.id}`);
}

export async function sendPurchaseOrderAction(id: string): Promise<POFormState> {
  const res = await adminFetch(
    `/v1/admin/purchase-orders/${encodeURIComponent(id)}/send`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Send failed (${res.status})`,
    };
  }
  revalidatePath('/purchase-orders');
  revalidatePath(`/purchase-orders/${id}`);
  return { status: 'ok', message: 'Sent.' };
}

export async function cancelPurchaseOrderAction(id: string): Promise<POFormState> {
  const res = await adminFetch(
    `/v1/admin/purchase-orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Cancel failed (${res.status})`,
    };
  }
  revalidatePath('/purchase-orders');
  revalidatePath(`/purchase-orders/${id}`);
  return { status: 'ok', message: 'Cancelled.' };
}

export async function receivePurchaseOrderAction(
  id: string,
  formData: FormData,
): Promise<POFormState> {
  const lines: { lineId: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('qty:')) continue;
    const qty = Number.parseInt(value.toString(), 10);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const lineId = key.slice(4);
    lines.push({ lineId, qty });
  }
  if (lines.length === 0) {
    return { status: 'error', message: 'Enter at least one quantity to receive.' };
  }
  const res = await adminFetch(
    `/v1/admin/purchase-orders/${encodeURIComponent(id)}/receive`,
    {
      method: 'POST',
      body: JSON.stringify({ lines }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Receive failed (${res.status})`,
    };
  }
  revalidatePath('/purchase-orders');
  revalidatePath(`/purchase-orders/${id}`);
  return { status: 'ok', message: 'Inventory updated.' };
}
