'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface TaxRateFormState {
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

function buildBody(formData: FormData): BuildBodyResult {
  const name = trimOrUndefined(formData.get('name'));
  const country = trimOrUndefined(formData.get('countryCode'))?.toUpperCase();
  const rateRaw = trimOrUndefined(formData.get('rateBp'));
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return { ok: false, error: 'Country code must be 2 letters (e.g. FR, US).' };
  }
  const rateBp = rateRaw ? Number.parseInt(rateRaw, 10) : NaN;
  if (!Number.isFinite(rateBp) || rateBp < 0 || rateBp > 10_000) {
    return { ok: false, error: 'Rate (basis points) must be 0..10000.' };
  }
  const region = trimOrUndefined(formData.get('regionCode'));
  const postcode = trimOrUndefined(formData.get('postcodePattern'));
  const priorityRaw = trimOrUndefined(formData.get('priority'));
  const priority = priorityRaw ? Number.parseInt(priorityRaw, 10) : 0;
  const isActive = formData.get('isActive') !== 'false';
  return {
    ok: true,
    body: {
      name,
      countryCode: country,
      rateBp,
      priority,
      isActive,
      ...(region ? { regionCode: region } : {}),
      ...(postcode ? { postcodePattern: postcode } : {}),
    },
  };
}

export async function createTaxRateAction(
  _prev: TaxRateFormState,
  formData: FormData,
): Promise<TaxRateFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch('/v1/admin/tax-rates', {
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
  revalidatePath('/tax-rates');
  redirect(`/tax-rates/${data.data.id}`);
}

export async function updateTaxRateAction(
  id: string,
  _prev: TaxRateFormState,
  formData: FormData,
): Promise<TaxRateFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/tax-rates/${encodeURIComponent(id)}`, {
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
  revalidatePath('/tax-rates');
  revalidatePath(`/tax-rates/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteTaxRateAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/tax-rates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/tax-rates');
  redirect('/tax-rates');
}
