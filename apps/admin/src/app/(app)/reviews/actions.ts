'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

export async function moderateReviewAction(
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'PENDING',
): Promise<{ ok: boolean; message: string }> {
  const res = await adminFetch(`/v1/admin/reviews/${encodeURIComponent(id)}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      ok: false,
      message: body?.error?.message ?? `Moderation failed (${res.status})`,
    };
  }
  revalidatePath('/reviews');
  return { ok: true, message: status };
}

export async function deleteReviewAction(id: string): Promise<void> {
  const res = await adminFetch(`/v1/admin/reviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  revalidatePath('/reviews');
}
