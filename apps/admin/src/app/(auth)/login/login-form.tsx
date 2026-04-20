'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import { loginAction, type LoginFormState } from './actions';

const INITIAL: LoginFormState = { status: 'idle' };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginFormState, FormData>(
    loginAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue="demo@claudeshop.local"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {state.status === 'error' ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Signing in…' : 'Continue'}
      </Button>
    </form>
  );
}
