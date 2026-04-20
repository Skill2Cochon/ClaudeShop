'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export interface PageFormState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function parseLocalizedField(raw: FormDataEntryValue | null): Record<string, string> | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function pickStatus(raw: FormDataEntryValue | null): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
  if (raw === 'PUBLISHED' || raw === 'ARCHIVED') return raw;
  return 'DRAFT';
}

export async function createPageAction(
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const slug = (formData.get('slug') ?? '').toString().trim();
  const status = pickStatus(formData.get('status'));
  const title = parseLocalizedField(formData.get('title'));
  const body = parseLocalizedField(formData.get('body'));

  if (!slug) return { status: 'error', message: 'Slug is required.' };
  if (!title) return { status: 'error', message: 'Title must be valid JSON like {"en":"…"}.' };
  if (!body) return { status: 'error', message: 'Body must be valid JSON like {"en":"# Hello"}.' };

  const res = await adminFetch('/v1/admin/pages', {
    method: 'POST',
    body: JSON.stringify({ slug, status, title, body }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Failed to create (${res.status})`,
    };
  }

  const data = (await res.json()) as { data: { id: string } };
  revalidatePath('/pages');
  redirect(`/pages/${data.data.id}`);
}

export async function updatePageAction(
  pageId: string,
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const slug = (formData.get('slug') ?? '').toString().trim();
  const status = pickStatus(formData.get('status'));
  const title = parseLocalizedField(formData.get('title'));
  const body = parseLocalizedField(formData.get('body'));
  const publish = formData.get('publish') === 'on';

  const patch: Record<string, unknown> = {};
  if (slug.length > 0) patch.slug = slug;
  if (title) patch.title = title;
  if (body) patch.body = body;
  if (!publish) patch.status = status;
  if (publish) patch.publish = true;

  const res = await adminFetch(`/v1/admin/pages/${encodeURIComponent(pageId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: errBody?.error?.message ?? `Failed to update (${res.status})`,
    };
  }

  revalidatePath('/pages');
  revalidatePath(`/pages/${pageId}`);
  return { status: 'ok', message: publish ? 'Published.' : 'Saved.' };
}

export async function deletePageAction(pageId: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/pages/${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Delete failed (${res.status})`);
  }
  revalidatePath('/pages');
  redirect('/pages');
}
