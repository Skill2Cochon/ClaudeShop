'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface CampaignFormState {
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
  const subject = trimOrUndefined(formData.get('subject'));
  const bodyMd = trimOrUndefined(formData.get('bodyMd'));
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!subject) return { ok: false, error: 'Subject is required.' };
  if (!bodyMd) return { ok: false, error: 'Body is required.' };
  const segmentId = trimOrUndefined(formData.get('segmentId'));
  return {
    ok: true,
    body: {
      name,
      subject,
      bodyMd,
      ...(segmentId ? { segmentId } : {}),
    },
  };
}

export async function createCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch('/v1/admin/campaigns', {
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
  revalidatePath('/campaigns');
  redirect(`/campaigns/${data.data.id}`);
}

export async function updateCampaignAction(
  id: string,
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/campaigns/${encodeURIComponent(id)}`, {
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
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteCampaignAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/campaigns');
  redirect('/campaigns');
}

export async function sendCampaignAction(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await adminFetch(`/v1/admin/campaigns/${encodeURIComponent(id)}/send`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      ok: false,
      message: body?.error?.message ?? `Send failed (${res.status})`,
    };
  }
  const data = (await res.json()) as {
    data: { sentCount: number; failedCount: number };
  };
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return {
    ok: true,
    message: `Sent ${data.data.sentCount} email${data.data.sentCount === 1 ? '' : 's'}${
      data.data.failedCount > 0 ? `, ${data.data.failedCount} failed` : ''
    }.`,
  };
}
