'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerAddress } from '@claudeshop/contracts/customer';
import { Button } from '@claudeshop/ui';
import {
  placeGuestOrderAction,
  type PlaceGuestOrderResult,
} from '../cart/actions';

interface CheckoutFormProps {
  locale: string;
  /** Phase 50d — default address of the signed-in customer, if any. */
  prefill?: CustomerAddress;
  /** Phase 50d — session email pre-fills the contact block. */
  sessionEmail?: string;
}

/**
 * Client form wired to the Zod-validated server action. We use
 * `useActionState` so field-level errors render inline (the default
 * Next error boundary is too heavy for validation UX). On success the
 * action returns an order id and we redirect client-side — the action
 * can't call `redirect()` itself because Next swallows its thrown
 * RedirectError when the action returns a value.
 */
export function CheckoutForm({
  locale,
  prefill,
  sessionEmail,
}: CheckoutFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    PlaceGuestOrderResult | undefined,
    FormData
  >(placeGuestOrderAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/${locale}/order/${state.orderId}/confirmed`);
    }
  }, [state, locale, router]);

  const errors = !state?.ok && state?.errors ? state.errors : {};
  const formError = errors._form;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {formError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border bg-card p-5" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Contact
        </legend>
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          error={errors.email}
          hint="We'll send the receipt here."
          defaultValue={sessionEmail ?? ''}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            name="firstName"
            label="First name"
            autoComplete="given-name"
            required
            error={errors.firstName}
            defaultValue={prefill?.firstName ?? ''}
          />
          <Field
            name="lastName"
            label="Last name"
            autoComplete="family-name"
            required
            error={errors.lastName}
            defaultValue={prefill?.lastName ?? ''}
          />
        </div>
        <Field
          name="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          placeholder="+33 1 23 45 67 89"
          error={errors.phone}
          hint="Only used if the carrier needs to reach you."
          defaultValue={prefill?.phone ?? ''}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border bg-card p-5" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Shipping address
        </legend>
        <Field
          name="company"
          label="Company (optional)"
          autoComplete="organization"
          error={errors.company}
          defaultValue={prefill?.company ?? ''}
        />
        <Field
          name="line1"
          label="Street address"
          autoComplete="address-line1"
          required
          error={errors.line1}
          defaultValue={prefill?.line1 ?? ''}
        />
        <Field
          name="line2"
          label="Apartment, suite, etc. (optional)"
          autoComplete="address-line2"
          error={errors.line2}
          defaultValue={prefill?.line2 ?? ''}
        />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Field
            name="city"
            label="City"
            autoComplete="address-level2"
            required
            error={errors.city}
            defaultValue={prefill?.city ?? ''}
          />
          <Field
            name="region"
            label="Region / State"
            autoComplete="address-level1"
            error={errors.region}
            hint="Required in some countries (e.g., US, CA)."
            defaultValue={prefill?.region ?? ''}
          />
          <Field
            name="postcode"
            label="Postcode"
            autoComplete="postal-code"
            required
            error={errors.postcode}
            defaultValue={prefill?.postcode ?? ''}
          />
        </div>
        <Field
          name="country"
          label="Country"
          autoComplete="country"
          required
          maxLength={2}
          placeholder="FR"
          uppercase
          error={errors.country}
          hint="Two-letter ISO code — FR, US, GB, DE…"
          defaultValue={prefill?.country ?? ''}
        />
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Placing order…' : 'Place order'}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        No payment collected in this phase — payment comes in after
        inventory reserves stock (Phase 2.4+).
      </p>
    </form>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
}

function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  required,
  placeholder,
  maxLength,
  uppercase,
  hint,
  error,
  defaultValue,
}: FieldProps) {
  const id = `f-${name}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-sm font-medium"
      >
        <span>
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </span>
        {hint ? (
          <span className="text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          error ? 'border-destructive' : 'border-input'
        } ${uppercase ? 'uppercase' : ''}`}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
