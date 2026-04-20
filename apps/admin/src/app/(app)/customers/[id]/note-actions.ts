'use server';

import { revalidatePath } from 'next/cache';
import { appendCustomerNote } from '@/lib/api';
import { getCurrentSession } from '@/lib/session';

/**
 * Phase 44 — append a customer (CRM) note. Mirrors Phase 42's
 * appendOrderNoteAction: server-side only, reads the admin session
 * to fill authorName + authorId, revalidates the detail page so the
 * new note shows up immediately.
 */
export async function appendCustomerNoteAction(
  customerId: string,
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

  await appendCustomerNote(customerId, {
    body,
    authorName: session.displayName ?? session.email,
    authorId: session.userId,
  });

  revalidatePath(`/customers/${customerId}`);
}
