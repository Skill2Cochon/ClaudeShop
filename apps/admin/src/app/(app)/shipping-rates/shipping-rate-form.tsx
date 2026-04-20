'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createShippingRateAction,
  updateShippingRateAction,
  type ShippingRateFormState,
} from './actions';

const INITIAL: ShippingRateFormState = { status: 'idle' };

interface ShippingRateFormProps {
  shippingRateId?: string;
  initial?: {
    name: string;
    countryCodes: string[];
    currency: string;
    basePriceCents: number;
    minSubtotalCents: number | null;
    freeShippingAboveCents: number | null;
    estimatedDays: number | null;
    isActive: boolean;
  };
}

export function ShippingRateForm({ shippingRateId, initial }: ShippingRateFormProps) {
  const isEdit = Boolean(shippingRateId);
  const bound = isEdit
    ? updateShippingRateAction.bind(null, shippingRateId!)
    : createShippingRateAction;
  const [state, formAction, isPending] = useActionState<ShippingRateFormState, FormData>(
    bound,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="name"
          label="Name"
          required
          defaultValue={initial?.name ?? ''}
          placeholder="EU Standard 3-5 days"
        />
        <Field
          id="currency"
          label="Currency"
          required
          maxLength={3}
          mono
          defaultValue={initial?.currency ?? 'EUR'}
        />
      </div>
      <Field
        id="countryCodes"
        label="Country codes (comma-separated)"
        required
        mono
        defaultValue={(initial?.countryCodes ?? ['FR']).join(', ')}
        placeholder="FR, DE, IT, ES, NL, BE"
        hint="2-letter ISO codes."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          id="basePriceCents"
          label="Base price (cents)"
          type="number"
          required
          min={0}
          defaultValue={String(initial?.basePriceCents ?? 700)}
          hint="700 = €7.00"
        />
        <Field
          id="minSubtotalCents"
          label="Min subtotal (cents)"
          type="number"
          min={0}
          defaultValue={
            initial?.minSubtotalCents != null ? String(initial.minSubtotalCents) : ''
          }
          hint="Skip rate below this basket. Optional."
        />
        <Field
          id="freeShippingAboveCents"
          label="Free above (cents)"
          type="number"
          min={0}
          defaultValue={
            initial?.freeShippingAboveCents != null
              ? String(initial.freeShippingAboveCents)
              : ''
          }
          hint="Free when basket ≥ this. Optional."
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="estimatedDays"
          label="Estimated days"
          type="number"
          min={1}
          defaultValue={
            initial?.estimatedDays != null ? String(initial.estimatedDays) : ''
          }
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <select
            name="isActive"
            defaultValue={initial?.isActive === false ? 'false' : 'true'}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="true">ACTIVE</option>
            <option value="false">INACTIVE</option>
          </select>
        </div>
      </div>

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
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create shipping rate'}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
  type,
  required,
  mono,
  hint,
  min,
  maxLength,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
  hint?: string;
  min?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type ?? 'text'}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        maxLength={maxLength}
        className={`mt-1 w-full rounded-md border bg-background p-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
