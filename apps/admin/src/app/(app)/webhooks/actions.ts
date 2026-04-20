'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface WebhookFormState {
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
  const url = trimOrUndefined(formData.get('url'));
  const eventsRaw = trimOrUndefined(formData.get('events'));
  if (!url) return { ok: false, error: 'URL is required.' };
  try {
    new URL(url);
  } catch {
    return { ok: false, error: 'URL must be a valid http(s) URL.' };
  }
  if (!eventsRaw) {
    return {
      ok: false,
      error: 'Events list is required (comma-separated, e.g. order.placed).',
    };
  }
  const events = eventsRaw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  if (events.length === 0) return { ok: false, error: 'No events parsed.' };
  const secret = trimOrUndefined(formData.get('secret'));
  const isActive = formData.get('isActive') !== 'false';
  return {
    ok: true,
    body: {
      url,
      events,
      isActive,
      ...(secret ? { secret } : {}),
    },
  };
}

export async function createWebhookAction(
  _prev: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch('/v1/admin/webhooks', {
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
  revalidatePath('/webhooks');
  redirect(`/webhooks/${data.data.id}`);
}

export async function updateWebhookAction(
  id: string,
  _prev: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const built = buildBody(formData);
  if (!built.ok) return { status: 'error', message: built.error };
  const res = await adminFetch(`/v1/admin/webhooks/${encodeURIComponent(id)}`, {
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
  revalidatePath('/webhooks');
  revalidatePath(`/webhooks/${id}`);
  return { status: 'ok', message: 'Saved.' };
}

export async function deleteWebhookAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/webhooks');
  redirect('/webhooks');
}
