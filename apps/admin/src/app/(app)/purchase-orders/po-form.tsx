'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createPurchaseOrderAction,
  type POFormState,
} from './actions';

const INITIAL: POFormState = { status: 'idle' };

interface POFormProps {
  suppliers: Array<{ id: string; name: string; currency: string }>;
}

const STARTER_LINES = JSON.stringify(
  [{ variantId: 'cmv1xxxxxxxxxxxxxxxxxxxx', sku: 'TEE-S-BLK', qtyOrdered: 10, unitCost: '5.00' }],
  null,
  2,
);

export function POForm({ suppliers }: POFormProps) {
  const [state, formAction, isPending] = useActionState<POFormState, FormData>(
    createPurchaseOrderAction,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="supplierId">Supplier</Label>
          <select
            id="supplierId"
            name="supplierId"
            required
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="">— pick a supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.currency})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <input
            id="currency"
            name="currency"
            required
            maxLength={3}
            defaultValue="EUR"
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-sm"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Must match the supplier's currency.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="expectedAt">Expected delivery</Label>
        <input
          id="expectedAt"
          name="expectedAt"
          type="datetime-local"
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
        />
      </div>

      <div>
        <Label htmlFor="lines">Lines (JSON)</Label>
        <textarea
          id="lines"
          name="lines"
          rows={8}
          required
          defaultValue={STARTER_LINES}
          className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Array of <code>{`{ variantId, sku, qtyOrdered, unitCost }`}</code>. Phase 10.1 adds
          a per-line picker UI.
        </p>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
        />
      </div>

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create draft PO'}
      </Button>
    </form>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </label>
  );
}
