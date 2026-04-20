'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createSupplierAction,
  updateSupplierAction,
  type SupplierFormState,
} from './actions';

const INITIAL: SupplierFormState = { status: 'idle' };

interface SupplierFormProps {
  supplierId?: string;
  initial?: {
    name: string;
    contactEmail: string | null;
    phone: string | null;
    currency: string;
    paymentTermsDays: number;
    notes: string | null;
    isActive: boolean;
  };
}

export function SupplierForm({ supplierId, initial }: SupplierFormProps) {
  const isEdit = Boolean(supplierId);
  const bound = isEdit ? updateSupplierAction.bind(null, supplierId!) : createSupplierAction;
  const [state, formAction, isPending] = useActionState<SupplierFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="name" label="Name" required defaultValue={initial?.name ?? ''} />
        <Field
          id="currency"
          label="Currency"
          required
          defaultValue={initial?.currency ?? 'EUR'}
          maxLength={3}
          mono
          hint="ISO 4217 code (EUR/USD/…)"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="contactEmail"
          label="Contact email"
          type="email"
          defaultValue={initial?.contactEmail ?? ''}
        />
        <Field id="phone" label="Phone" defaultValue={initial?.phone ?? ''} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="paymentTermsDays"
          label="Payment terms (days)"
          type="number"
          min={0}
          defaultValue={String(initial?.paymentTermsDays ?? 30)}
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
      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ''}
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
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
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create supplier'}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
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
        required={required}
        min={min}
        maxLength={maxLength}
        className={`mt-1 w-full rounded-md border bg-background p-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
