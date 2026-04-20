'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface ShippingRateFormState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

type BuildBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

function trimOrUndefined(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function buildBody(formData: FormData): BuildBodyResult {
  const name = trimOrUndefined(formData.get('name'));
  const currency = trimOrUndefined(formData.get('currency'))?.toUpperCase();
  const countriesRaw = trimOrUndefined(formData.get('countryCodes'));
  const baseRaw = trimOrUndefined(formData.get('basePriceCents'));
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!currency || currency.length !== 3) {
    return { ok: false, error: 'Currency must be a 3-letter ISO code.' };
  }
  if (!countriesRaw) {
    return {
      ok: false,
      error: 'Countries are required (comma-separated 2-letter codes, e.g. FR,DE,IT).',
    };
  }
  const countryCodes = countriesRaw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (countryCodes.length === 0) {
    return { ok: false, error: 'No valid 2-letter country codes parsed.' };
  }
  const basePriceCents = baseRaw ? Number.parseInt(baseRaw, 10) : NaN;
  if (!Number.isFinite(basePriceCents) || basePriceCents < 0) {
    return { ok: false, error: 'Base price (cents) must be ≥ 0.' };
  }
  const isActive = formData.get('isActive') !== 'false';
  return {
    ok: true,
    body: {
      name,
      currency,
      countryCodes,
      basePriceCents,
      minSubtotalCents: intOrNull(formData.get('minSubtotalCents')),
      freeShippingAboveCents: intOrNull(formData.get('freeShippingAboveCents')),
      estimatedDays: intOrNull(formData.get('estimatedDays')),
      isActive,
    },
  };
}

export async function createShippingRateAction(
  _prev: ShippingRateFormState,
  formData: FormData,
): Promise<ShippingRateFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch('/v1/admin/shipping-rates', {
    method: 'POST',
    body: JSON.stringify(built.body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Failed to create (${res.status})`,
    };
  }
  const data = (await res.json()) as { data: { id: string } };
  revalidatePath('/shipping-rates');
  redirect(`/shipping-rates/${data.data.id}`);
}

export async function updateShippingRateAction(
  id: string,
  _prev: ShippingRateFormState,
  formData: FormData,
): Promise<ShippingRateFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/shipping-rates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(built.body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Failed to update (${res.status})`,
    };
  }
  revalidatePath('/shipping-rates');
  revalidatePath(`/shipping-rates/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteShippingRateAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/shipping-rates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/shipping-rates');
  redirect('/shipping-rates');
}
