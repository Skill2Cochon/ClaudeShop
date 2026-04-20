'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  applyPromotionCodeAction,
  type ApplyPromotionState,
} from './promotion-actions';

const INITIAL: ApplyPromotionState = { status: 'idle' };

interface PromotionFormProps {
  subtotal: string;
  currency: string;
}

export function PromotionForm({ subtotal, currency }: PromotionFormProps) {
  const boundAction = applyPromotionCodeAction.bind(null, { subtotal, currency });
  const [state, formAction, isPending] = useActionState<ApplyPromotionState, FormData>(
    boundAction,
    INITIAL,
  );

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex items-center gap-2">
        <input
          name="code"
          placeholder="Promo code"
          aria-label="Promotion code"
          className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm uppercase"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? 'Checking…' : 'Apply'}
        </Button>
      </form>

      {state.status === 'ok' ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          <span className="font-semibold">{state.applied.code} applied</span> —{' '}
          {state.applied.summary}
          {state.applied.type !== 'FREE_SHIPPING' ? (
            <>
              {' '}· discount <strong>−{state.applied.discount} {state.applied.currency}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
