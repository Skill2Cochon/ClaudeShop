'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface SegmentFormState {
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
  if (!name) return { ok: false, error: 'Name is required.' };
  const description = trimOrUndefined(formData.get('description'));

  const customerGroup = trimOrUndefined(formData.get('customerGroup'));
  const acceptsMarketingRaw = trimOrUndefined(formData.get('acceptsMarketing'));
  const hasOrderedRaw = trimOrUndefined(formData.get('hasOrdered'));
  const minLifetimeRaw = trimOrUndefined(formData.get('minLifetimeValueCents'));
  const createdWithinRaw = trimOrUndefined(formData.get('createdWithinDays'));

  const rules: Record<string, unknown> = {};
  if (customerGroup === 'B2C' || customerGroup === 'B2B' || customerGroup === 'VIP') {
    rules.customerGroup = customerGroup;
  }
  if (acceptsMarketingRaw === 'true') rules.acceptsMarketing = true;
  else if (acceptsMarketingRaw === 'false') rules.acceptsMarketing = false;
  if (hasOrderedRaw === 'true') rules.hasOrdered = true;
  else if (hasOrderedRaw === 'false') rules.hasOrdered = false;
  if (minLifetimeRaw) {
    const n = Number.parseInt(minLifetimeRaw, 10);
    if (Number.isFinite(n) && n >= 0) rules.minLifetimeValueCents = n;
  }
  if (createdWithinRaw) {
    const n = Number.parseInt(createdWithinRaw, 10);
    if (Number.isFinite(n) && n > 0) rules.createdWithinDays = n;
  }

  return {
    ok: true,
    body: { name, ...(description ? { description } : {}), rules },
  };
}

export async function createSegmentAction(
  _prev: SegmentFormState,
  formData: FormData,
): Promise<SegmentFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch('/v1/admin/segments', {
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
  revalidatePath('/segments');
  redirect(`/segments/${data.data.id}`);
}

export async function updateSegmentAction(
  id: string,
  _prev: SegmentFormState,
  formData: FormData,
): Promise<SegmentFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/segments/${encodeURIComponent(id)}`, {
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
  revalidatePath('/segments');
  revalidatePath(`/segments/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteSegmentAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/segments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/segments');
  redirect('/segments');
}

export async function refreshSegmentAction(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await adminFetch(
    `/v1/admin/segments/${encodeURIComponent(id)}/refresh`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      ok: false,
      message: body?.error?.message ?? `Refresh failed (${res.status})`,
    };
  }
  const data = (await res.json()) as {
    data: { customerCount: number; refreshedAt: string };
  };
  revalidatePath('/segments');
  revalidatePath(`/segments/${id}`);
  return {
    ok: true,
    message: `${data.data.customerCount} customer${data.data.customerCount === 1 ? '' : 's'} match.`,
  };
}
