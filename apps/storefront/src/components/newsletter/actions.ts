'use server';

import { z } from 'zod';
import { subscribeToNewsletter } from '@/lib/api';

export type NewsletterState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  source: z.string().trim().min(1).max(64).optional(),
  /** Honeypot — bots tend to fill hidden inputs. Empty = human. */
  _hp: z.string().max(0).optional(),
});

/**
 * Phase 58 — newsletter opt-in action. Honeypot field catches the
 * majority of drive-by bots without leaking the signal via a 4xx:
 * we return the same "ok" shape a real subscribe would produce, so
 * bots think they succeeded while the email never reaches the API.
 */
export async function subscribeNewsletterAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const raw = {
    email: (formData.get('email') ?? '').toString(),
    source: (formData.get('source') ?? '').toString() || undefined,
    _hp: (formData.get('_hp') ?? '').toString(),
  };
  const parsed = SubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid email.',
    };
  }

  if (parsed.data._hp && parsed.data._hp.length > 0) {
    // Silent "ok" for honeypot hits.
    return { status: 'ok' };
  }

  try {
    await subscribeToNewsletter({
      email: parsed.data.email,
      ...(parsed.data.source ? { source: parsed.data.source } : {}),
    });
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not subscribe.';
    return { status: 'error', message };
  }
}
