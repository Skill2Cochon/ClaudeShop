'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error?: { message?: string };
}

/**
 * Redeliver a specific WebhookDelivery by id. Surfaces the API error
 * message through `throw` so native <form action> shows Next.js's error
 * boundary instead of silently failing.
 */
export async function redeliverWebhookAction(deliveryId: string): Promise<void> {
  const res = await adminFetch(
    `/v1/admin/webhook-deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(
      body?.error?.message ?? `Redeliver failed (${res.status})`,
    );
  }
  revalidatePath('/webhooks/deliveries');
  revalidatePath('/webhooks');
}
