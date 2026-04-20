'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createSegmentAction,
  updateSegmentAction,
  type SegmentFormState,
} from './actions';

const INITIAL: SegmentFormState = { status: 'idle' };

interface SegmentFormProps {
  segmentId?: string;
  initial?: {
    name: string;
    description: string | null;
    rules: {
      customerGroup?: 'B2C' | 'B2B' | 'VIP';
      acceptsMarketing?: boolean;
      hasOrdered?: boolean;
      minLifetimeValueCents?: number;
      createdWithinDays?: number;
    };
  };
}

export function SegmentForm({ segmentId, initial }: SegmentFormProps) {
  const isEdit = Boolean(segmentId);
  const bound = isEdit ? updateSegmentAction.bind(null, segmentId!) : createSegmentAction;
  const [state, formAction, isPending] = useActionState<SegmentFormState, FormData>(
    bound,
    INITIAL,
  );
  const r = initial?.rules ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <input
            id="name"
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="VIP customers"
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <input
            id="description"
            name="description"
            defaultValue={initial?.description ?? ''}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border bg-background p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rules (all conditions ANDed)
        </legend>

        <div className="grid gap-3 md:grid-cols-3">
          <Tri
            id="customerGroup"
            label="Customer group"
            options={[
              { value: '', label: 'Any' },
              { value: 'B2C', label: 'B2C' },
              { value: 'B2B', label: 'B2B' },
              { value: 'VIP', label: 'VIP' },
            ]}
            defaultValue={r.customerGroup ?? ''}
          />
          <Tri
            id="acceptsMarketing"
            label="Accepts marketing"
            options={[
              { value: '', label: 'Any' },
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            defaultValue={
              r.acceptsMarketing === undefined ? '' : r.acceptsMarketing ? 'true' : 'false'
            }
          />
          <Tri
            id="hasOrdered"
            label="Has placed an order"
            options={[
              { value: '', label: 'Any' },
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            defaultValue={
              r.hasOrdered === undefined ? '' : r.hasOrdered ? 'true' : 'false'
            }
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="minLifetimeValueCents">Min lifetime value (cents)</Label>
            <input
              id="minLifetimeValueCents"
              name="minLifetimeValueCents"
              type="number"
              min={0}
              defaultValue={
                r.minLifetimeValueCents != null ? String(r.minLifetimeValueCents) : ''
              }
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              placeholder="Phase 11.1 — currently accepted but ignored"
            />
          </div>
          <div>
            <Label htmlFor="createdWithinDays">Created within last N days</Label>
            <input
              id="createdWithinDays"
              name="createdWithinDays"
              type="number"
              min={1}
              defaultValue={
                r.createdWithinDays != null ? String(r.createdWithinDays) : ''
              }
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}
      {state.status === 'ok' ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create segment'}
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

function Tri({
  id,
  label,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
