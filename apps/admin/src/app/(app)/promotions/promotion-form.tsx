'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createPromotionAction,
  updatePromotionAction,
  type PromotionFormState,
} from './actions';

const INITIAL: PromotionFormState = { status: 'idle' };

interface PromotionFormProps {
  promotionId?: string;
  initial?: {
    code: string;
    name: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
    value: number;
    status: 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'EXPIRED';
    currency: string | null;
    minSubtotalCents: number | null;
    startsAt: string | null;
    endsAt: string | null;
    maxRedemptions: number | null;
  };
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromotionForm({ promotionId, initial }: PromotionFormProps) {
  const isEdit = Boolean(promotionId);
  const bound = isEdit ? updatePromotionAction.bind(null, promotionId!) : createPromotionAction;
  const [state, formAction, isPending] = useActionState<PromotionFormState, FormData>(
    bound,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id="code"
          label="Code"
          defaultValue={initial?.code ?? ''}
          placeholder="WELCOME10"
          required
          mono
          hint="3–32 chars. Uppercase letters, digits, and hyphens."
        />
        <TextField
          id="name"
          label="Name"
          defaultValue={initial?.name ?? ''}
          placeholder="Welcome 10% off"
          required
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={initial?.type ?? 'PERCENTAGE'}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="PERCENTAGE">PERCENTAGE — % off subtotal</option>
            <option value="FIXED_AMOUNT">FIXED_AMOUNT — cents off</option>
            <option value="FREE_SHIPPING">FREE_SHIPPING — zero shipping</option>
          </select>
        </div>
        <TextField
          id="value"
          label="Value"
          type="number"
          min={0}
          defaultValue={String(initial?.value ?? 0)}
          hint="PERCENTAGE: 1–100 · FIXED_AMOUNT: minor units (500 = €5.00) · FREE_SHIPPING: ignored"
        />
        <TextField
          id="currency"
          label="Currency (FIXED_AMOUNT only)"
          defaultValue={initial?.currency ?? ''}
          placeholder="EUR"
          mono
          maxLength={3}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? 'ACTIVE'}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="DISABLED">DISABLED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
        <TextField
          id="minSubtotalCents"
          label="Min subtotal (cents)"
          type="number"
          min={0}
          defaultValue={
            initial?.minSubtotalCents != null ? String(initial.minSubtotalCents) : ''
          }
          hint="Leave empty for no minimum."
        />
        <TextField
          id="maxRedemptions"
          label="Max redemptions"
          type="number"
          min={1}
          defaultValue={
            initial?.maxRedemptions != null ? String(initial.maxRedemptions) : ''
          }
          hint="Leave empty for unlimited."
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id="startsAt"
          label="Starts at"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(initial?.startsAt)}
        />
        <TextField
          id="endsAt"
          label="Ends at"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(initial?.endsAt)}
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
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create promotion'}
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

function TextField({
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
      <Label htmlFor={id}>{label}</Label>
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
