'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  loginCustomerAction,
  registerCustomerAction,
  type AuthFormState,
} from './actions';

const INITIAL: AuthFormState = { status: 'idle' };

export function LoginFormClient({ locale }: { locale: string }) {
  const bound = loginCustomerAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <Field id="email" label="Email" type="email" required />
      <Field id="password" label="Password" type="password" required />
      {state.status === 'error' ? <ErrorBox message={state.message} /> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        New here?{' '}
        <Link href={`/${locale}/register`} className="underline hover:no-underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterFormClient({ locale }: { locale: string }) {
  const bound = registerCustomerAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <Field id="displayName" label="Name (optional)" type="text" />
      <Field id="email" label="Email" type="email" required />
      <Field
        id="password"
        label="Password"
        type="password"
        required
        minLength={8}
        hint="At least 8 characters."
      />
      {state.status === 'error' ? <ErrorBox message={state.message} /> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have one?{' '}
        <Link href={`/${locale}/login`} className="underline hover:no-underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  required,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        minLength={minLength}
        autoComplete={
          id === 'email' ? 'email' : id === 'password' ? 'current-password' : undefined
        }
        className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
      />
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ErrorBox({ message }: { message?: string }) {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
      {message}
    </div>
  );
}
