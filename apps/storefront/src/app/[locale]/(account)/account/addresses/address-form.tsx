'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerAddress } from '@claudeshop/contracts/customer';
import { Button } from '@claudeshop/ui';
import {
  createAddressAction,
  updateAddressAction,
  type AddressFormResult,
} from './actions';

interface AddressFormProps {
  locale: string;
  /** When present the form runs updateAddressAction, otherwise create. */
  address?: CustomerAddress;
  submitLabel: string;
  cancelHref: string;
}

/**
 * Phase 50 — shared create/edit address form. Mirrors the checkout
 * form's layout (Phase 35) so customers who filled the guest form
 * feel at home here. Uses `useActionState` so field-level Zod
 * errors render inline without throwing to Next's error boundary.
 */
export function AddressForm({
  locale,
  address,
  submitLabel,
  cancelHref,
}: AddressFormProps) {
  const router = useRouter();
  const action = address
    ? updateAddressAction.bind(null, locale, address.id)
    : createAddressAction.bind(null, locale);
  const [state, formAction, pending] = useActionState<
    AddressFormResult | undefined,
    FormData
  >(action, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/${locale}/account/addresses`);
    }
  }, [state, locale, router]);

  const errors = !state?.ok && state?.errors ? state.errors : {};
  const formError = errors._form;

  return (
    <form action={formAction} className="space-y-6">
      {formError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border bg-card p-5" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Label
        </legend>
        <Field
          name="label"
          label="Name this address (optional)"
          placeholder="Home · Office · Mum's house"
          defaultValue={address?.label ?? ''}
          error={errors.label}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border bg-card p-5" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Contact
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            name="firstName"
            label="First name"
            autoComplete="given-name"
            required
            defaultValue={address?.firstName ?? ''}
            error={errors.firstName}
          />
          <Field
            name="lastName"
            label="Last name"
            autoComplete="family-name"
            required
            defaultValue={address?.lastName ?? ''}
            error={errors.lastName}
          />
        </div>
        <Field
          name="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          defaultValue={address?.phone ?? ''}
          error={errors.phone}
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
          defaultValue={address?.company ?? ''}
          error={errors.company}
        />
        <Field
          name="line1"
          label="Street address"
          autoComplete="address-line1"
          required
          defaultValue={address?.line1 ?? ''}
          error={errors.line1}
        />
        <Field
          name="line2"
          label="Apartment, suite, etc. (optional)"
          autoComplete="address-line2"
          defaultValue={address?.line2 ?? ''}
          error={errors.line2}
        />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Field
            name="city"
            label="City"
            autoComplete="address-level2"
            required
            defaultValue={address?.city ?? ''}
            error={errors.city}
          />
          <Field
            name="region"
            label="Region / State"
            autoComplete="address-level1"
            defaultValue={address?.region ?? ''}
            error={errors.region}
          />
          <Field
            name="postcode"
            label="Postcode"
            autoComplete="postal-code"
            required
            defaultValue={address?.postcode ?? ''}
            error={errors.postcode}
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
          defaultValue={address?.country ?? ''}
          error={errors.country}
          hint="Two-letter ISO code — FR, US, GB, DE…"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
            className="h-4 w-4"
          />
          <span>Use as my default shipping address</span>
        </label>
      </fieldset>

      <div className="flex items-center justify-between">
        <a href={cancelHref} className="text-xs text-muted-foreground hover:underline">
          Cancel
        </a>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
