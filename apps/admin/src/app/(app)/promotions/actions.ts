'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface PromotionFormState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function trimOrUndefined(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(raw: FormDataEntryValue | null): string | null {
  const s = trimOrUndefined(raw);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type BuildBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

function buildBody(formData: FormData): BuildBodyResult {
  const code = trimOrUndefined(formData.get('code'))?.toUpperCase();
  const name = trimOrUndefined(formData.get('name'));
  const type = trimOrUndefined(formData.get('type'));
  const valueRaw = trimOrUndefined(formData.get('value'));
  const status = trimOrUndefined(formData.get('status')) ?? 'ACTIVE';

  if (!code) return { ok: false, error: 'Code is required.' };
  if (!name) return { ok: false, error: 'Name is required.' };
  if (type !== 'PERCENTAGE' && type !== 'FIXED_AMOUNT' && type !== 'FREE_SHIPPING') {
    return { ok: false, error: 'Pick a valid type.' };
  }

  const value = valueRaw ? Number.parseInt(valueRaw, 10) : 0;
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: 'Value must be ≥ 0.' };

  const currency = trimOrUndefined(formData.get('currency'))?.toUpperCase();
  const minSubtotalCents = intOrNull(formData.get('minSubtotalCents'));
  const startsAt = dateOrNull(formData.get('startsAt'));
  const endsAt = dateOrNull(formData.get('endsAt'));
  const maxRedemptions = intOrNull(formData.get('maxRedemptions'));

  return {
    ok: true,
    body: {
      code,
      name,
      type,
      value,
      status,
      currency: currency ?? null,
      minSubtotalCents,
      startsAt,
      endsAt,
      maxRedemptions,
    },
  };
}

export async function createPromotionAction(
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };

  const res = await adminFetch('/v1/admin/promotions', {
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
  revalidatePath('/promotions');
  redirect(`/promotions/${data.data.id}`);
}

export async function updatePromotionAction(
  id: string,
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };

  const res = await adminFetch(`/v1/admin/promotions/${encodeURIComponent(id)}`, {
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
  revalidatePath('/promotions');
  revalidatePath(`/promotions/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deletePromotionAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/promotions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Delete failed (${res.status})`);
  }
  revalidatePath('/promotions');
  redirect('/promotions');
}
