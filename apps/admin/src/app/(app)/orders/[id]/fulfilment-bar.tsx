import type { OrderStatus } from '@claudeshop/contracts/order';
import { transitionOrderStatusAction } from './actions';

interface FulfilmentBarProps {
  orderId: string;
  current: OrderStatus;
}

/**
 * Render the legal forward transitions as explicit buttons. Mirrors the
 * TRANSITIONS table in the transitionOrderStatus use-case — the API is
 * the source of truth, this UI is just the picker. Illegal clicks never
 * reach the server because disallowed transitions aren't surfaced here.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['FULFILLING', 'CANCELLED'],
  FULFILLING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Mark draft',
  PENDING_PAYMENT: 'Send to payment',
  PAID: 'Mark paid',
  FULFILLING: 'Start fulfilling',
  SHIPPED: 'Mark shipped',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
  REFUNDED: 'Mark refunded',
};

const STYLE: Record<OrderStatus, string> = {
  DRAFT: 'border bg-background hover:bg-muted',
  PENDING_PAYMENT: 'border bg-yellow-50 text-yellow-900 hover:bg-yellow-100',
  PAID: 'border border-emerald-400/50 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  FULFILLING: 'border border-sky-400/50 bg-sky-50 text-sky-900 hover:bg-sky-100',
  SHIPPED: 'border border-indigo-400/50 bg-indigo-50 text-indigo-900 hover:bg-indigo-100',
  DELIVERED: 'border border-emerald-500/50 bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
  CANCELLED: 'border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  REFUNDED: 'border border-orange-400/50 bg-orange-50 text-orange-900 hover:bg-orange-100',
};

export function FulfilmentBar({ orderId, current }: FulfilmentBarProps) {
  const allowed = TRANSITIONS[current];

  if (allowed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Order is in terminal state <code>{current}</code> — no further manual
        transitions. Refunds still flow through the Refund section below.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.map((next) => {
        const bound = transitionOrderStatusAction.bind(null, orderId, next);
        return (
          <form key={next} action={bound}>
            <button
              type="submit"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${STYLE[next]}`}
            >
              {LABEL[next]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
