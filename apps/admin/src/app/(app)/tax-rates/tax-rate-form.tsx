'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createTaxRateAction,
  updateTaxRateAction,
  type TaxRateFormState,
} from './actions';

const INITIAL: TaxRateFormState = { status: 'idle' };

interface TaxRateFormProps {
  taxRateId?: string;
  initial?: {
    name: string;
    countryCode: string;
    regionCode: string | null;
    postcodePattern: string | null;
    rateBp: number;
    priority: number;
    isActive: boolean;
  };
}

export function TaxRateForm({ taxRateId, initial }: TaxRateFormProps) {
  const isEdit = Boolean(taxRateId);
  const bound = isEdit ? updateTaxRateAction.bind(null, taxRateId!) : createTaxRateAction;
  const [state, formAction, isPending] = useActionState<TaxRateFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="name" label="Name" required defaultValue={initial?.name ?? ''} placeholder="VAT 20% (FR)" />
        <Field
          id="countryCode"
          label="Country"
          required
          maxLength={2}
          mono
          defaultValue={initial?.countryCode ?? 'FR'}
          hint="ISO 3166-1 alpha-2 (FR, US, DE…)"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          id="rateBp"
          label="Rate (basis points)"
          type="number"
          required
          min={0}
          max={10000}
          defaultValue={String(initial?.rateBp ?? 2000)}
          hint="2000 = 20.00%"
        />
        <Field
          id="priority"
          label="Priority"
          type="number"
          defaultValue={String(initial?.priority ?? 0)}
          hint="Higher wins when multiple rules match."
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
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="regionCode"
          label="Region"
          defaultValue={initial?.regionCode ?? ''}
          hint="Optional state/province code (CA, NY, BY…)"
        />
        <Field
          id="postcodePattern"
          label="Postcode pattern"
          defaultValue={initial?.postcodePattern ?? ''}
          hint="Optional regex/glob — matched against destination postcode."
          mono
        />
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
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create tax rate'}
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
  max,
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
  max?: number;
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
        max={max}
        maxLength={maxLength}
        className={`mt-1 w-full rounded-md border bg-background p-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
