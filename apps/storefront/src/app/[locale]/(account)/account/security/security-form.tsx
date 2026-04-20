'use client';

import { useActionState, useRef, useEffect } from 'react';
import { Button } from '@claudeshop/ui';
import {
  changePasswordAction,
  type ChangePasswordState,
} from './actions';

const INITIAL: ChangePasswordState = { status: 'idle' };

export function SecurityForm({ locale }: { locale: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const bound = changePasswordAction.bind(null, locale);
  const [state, formAction, pending] = useActionState<
    ChangePasswordState,
    FormData
  >(bound, INITIAL);

  // Reset the form on success so the merchant doesn't accidentally
  // resubmit the same inputs. The 'ok' banner stays visible until
  // the next submit.
  useEffect(() => {
    if (state.status === 'ok') formRef.current?.reset();
  }, [state]);

  const fieldError = (field: 'current' | 'new' | 'confirm'): string | null =>
    state.status === 'error' && state.field === field ? state.message : null;

  const formError =
    state.status === 'error' && !state.field ? state.message : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.status === 'ok' ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          🔐 Password updated. Stay signed in here — other devices will need
          the new one on next login.
        </div>
      ) : null}
      {formError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <Field
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        error={fieldError('current')}
      />
      <Field
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        hint="Minimum 8 characters. Use a passphrase."
        error={fieldError('new')}
      />
      <Field
        name="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        error={fieldError('confirm')}
      />

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
  hint,
  error,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  hint?: string;
  error: string | null;
}) {
  const id = `f-${name}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-sm font-medium"
      >
        <span>{label}</span>
        {hint ? (
          <span className="text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          error ? 'border-destructive' : 'border-input'
        }`}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
