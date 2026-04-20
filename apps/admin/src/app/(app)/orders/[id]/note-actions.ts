'use server';

import { revalidatePath } from 'next/cache';
import { appendOrderNote } from '@/lib/api';
import { getCurrentSession } from '@/lib/session';

/**
 * Phase 42 — append an order note. The admin session supplies
 * authorName (display name or email) + authorId so the API can write
 * it straight into the OrderNote row. Server-side only — there is
 * no "edit" or "delete" server action, append-only by design.
 */
export async function appendOrderNoteAction(
  orderId: string,
  formData: FormData,
): Promise<void> {
  const raw = formData.get('body');
  const body = typeof raw === 'string' ? raw.trim() : '';
  if (body.length === 0) {
    throw new Error('Note body is required.');
  }
  if (body.length > 4000) {
    throw new Error('Note is too long (max 4000 characters).');
  }

  const session = await getCurrentSession();
  if (!session) {
    throw new Error('You must be signed in to add a note.');
  }

  await appendOrderNote(orderId, {
    body,
    authorName: session.displayName ?? session.email,
    authorId: session.userId,
  });

  revalidatePath(`/orders/${orderId}`);
}
