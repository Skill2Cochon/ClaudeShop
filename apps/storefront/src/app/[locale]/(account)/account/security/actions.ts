'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { changePassword } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/session';

export type ChangePasswordState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string; field?: 'current' | 'new' | 'confirm' };

const FormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .max(256),
    confirm: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Confirmation does not match.',
    path: ['confirm'],
  });

/**
 * Phase 59 — change the signed-in customer's password. Redirects to
 * /login when the session is missing; returns a structured state
 * (with field hint) on validation / API errors so the form can
 * focus the right input.
 */
export async function changePasswordAction(
  locale: string,
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const parsed = FormSchema.safeParse({
    currentPassword: (formData.get('currentPassword') ?? '').toString(),
    newPassword: (formData.get('newPassword') ?? '').toString(),
    confirm: (formData.get('confirm') ?? '').toString(),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid input.',
      field: field === 'currentPassword'
        ? 'current'
        : field === 'newPassword'
          ? 'new'
          : 'confirm',
    };
  }

  try {
    await changePassword({
      userId: session.userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    // Wrong-current messages land as "Current password is incorrect" —
    // surface against that field so the UI can focus it.
    const isWrongCurrent = /current password/i.test(message);
    return isWrongCurrent
      ? { status: 'error', message, field: 'current' }
      : { status: 'error', message };
  }
}
