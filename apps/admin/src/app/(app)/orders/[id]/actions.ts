'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

interface RefundResponse {
  data: {
    orderId: string;
    orderNumber: string;
    refundId: string;
    amount: string;
    currency: string;
    isFullRefund: boolean;
  };
}

interface ApiError {
  error: { code: string; message: string; status: number };
}

/**
 * Admin refund action. Phase 2.7: the API auto-resolves providerRef from
 * the Payment row, so the form only needs amount + reason. Phase 2.6
 * fallback: if the API returns "no payment found", the caller can still
 * override via the optional providerRef form field.
 */
export async function refundOrderAction(
  orderId: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const amount = formData.get('amount');
  const reason = formData.get('reason');
  const providerRef = formData.get('providerRef');

  const res = await adminFetch(`/v1/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    headers: {
      'idempotency-key': `admin-refund-${orderId}-${Date.now()}`,
    },
    body: JSON.stringify({
      ...(typeof providerRef === 'string' && providerRef.length >= 4
        ? { providerRef }
        : {}),
      ...(typeof amount === 'string' && amount.length > 0 ? { amount } : {}),
      ...(typeof reason === 'string' && reason.length > 0 ? { reason } : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      ok: false,
      message: body?.error?.message ?? `Refund failed (${res.status})`,
    };
  }

  const body = (await res.json()) as RefundResponse;
  revalidatePath(`/orders/${orderId}`, 'page');
  revalidatePath('/orders', 'page');
  revalidatePath('/payments', 'page');

  return {
    ok: true,
    message: body.data.isFullRefund
      ? `Fully refunded ${body.data.amount} ${body.data.currency}`
      : `Partially refunded ${body.data.amount} ${body.data.currency}`,
  };
}

// ---------------------------------------------------------- Status transitions

type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FULFILLING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

/**
 * Move an order to a new status. The API enforces the allowed-transition
 * table so illegal moves surface as ValidationError → error envelope.
 * We throw so Next's error boundary shows the API message.
 */
export async function transitionOrderStatusAction(
  orderId: string,
  next: OrderStatus,
): Promise<void> {
  const res = await adminFetch(
    `/v1/admin/orders/${encodeURIComponent(orderId)}/status`,
    { method: 'POST', body: JSON.stringify({ next }) },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error?.message ?? `Transition failed (${res.status})`);
  }
  revalidatePath(`/orders/${orderId}`, 'page');
  revalidatePath('/orders', 'page');
}
