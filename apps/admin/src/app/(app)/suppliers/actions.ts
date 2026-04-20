'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface SupplierFormState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function trimOrUndefined(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type BuildBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

function buildBody(formData: FormData): BuildBodyResult {
  const name = trimOrUndefined(formData.get('name'));
  const currency = trimOrUndefined(formData.get('currency'))?.toUpperCase();
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!currency || currency.length !== 3) {
    return { ok: false, error: 'Currency must be a 3-letter ISO code (EUR/USD/…).' };
  }
  const contactEmail = trimOrUndefined(formData.get('contactEmail'));
  const phone = trimOrUndefined(formData.get('phone'));
  const notes = trimOrUndefined(formData.get('notes'));
  const paymentTermsRaw = trimOrUndefined(formData.get('paymentTermsDays'));
  const paymentTermsDays = paymentTermsRaw ? Number.parseInt(paymentTermsRaw, 10) : 30;
  const isActive = formData.get('isActive') !== 'false';
  return {
    ok: true,
    body: {
      name,
      currency,
      paymentTermsDays,
      isActive,
      ...(contactEmail ? { contactEmail } : {}),
      ...(phone ? { phone } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

export async function createSupplierAction(
  _prev: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };

  const res = await adminFetch('/v1/admin/suppliers', {
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
  revalidatePath('/suppliers');
  redirect(`/suppliers/${data.data.id}`);
}

export async function updateSupplierAction(
  id: string,
  _prev: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/suppliers/${encodeURIComponent(id)}`, {
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
  revalidatePath('/suppliers');
  revalidatePath(`/suppliers/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteSupplierAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/suppliers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/suppliers');
  redirect('/suppliers');
}
