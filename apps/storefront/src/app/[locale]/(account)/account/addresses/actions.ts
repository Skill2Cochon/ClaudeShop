'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from '@/lib/api';
import { getCurrentCustomer } from '@/lib/session';

/**
 * Phase 50 — address form schema. Mirrors the server-side
 * CreateCustomerAddressInputSchema but adds the "empty string =
 * omit" transforms the checkout form already uses, so both forms
 * share the same validation voice.
 */
const AddressFormSchema = z.object({
  label: z.string().trim().max(40).optional(),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  company: z.string().trim().max(120).optional(),
  line1: z.string().trim().min(1, 'Street address is required.').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required.').max(120),
  region: z.string().trim().max(120).optional(),
  postcode: z.string().trim().min(1, 'Postcode is required.').max(40),
  country: z
    .string()
    .trim()
    .length(2, 'Use a two-letter country code.')
    .regex(/^[A-Z]{2}$/, 'Country must be two uppercase letters.'),
  phone: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

export type AddressFormResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function readForm(formData: FormData): Record<string, unknown> {
  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === 'string' ? v : '';
  };
  const country = get('country').trim().toUpperCase();
  return {
    label: get('label') || undefined,
    firstName: get('firstName'),
    lastName: get('lastName'),
    company: get('company') || undefined,
    line1: get('line1'),
    line2: get('line2') || undefined,
    city: get('city'),
    region: get('region') || undefined,
    postcode: get('postcode'),
    country,
    phone: get('phone') || undefined,
    isDefault: formData.get('isDefault') === 'on',
  };
}

function collectErrors(zodIssues: z.ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of zodIssues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createAddressAction(
  locale: string,
  _prev: AddressFormResult | undefined,
  formData: FormData,
): Promise<AddressFormResult> {
  const session = await getCurrentCustomer();
  if (!session) {
    redirect(`/${locale}/login`);
  }
  const parsed = AddressFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, errors: collectErrors(parsed.error.issues) };
  }
  try {
    const created = await createAddress(session.email, parsed.data);
    revalidatePath(`/${locale}/account/addresses`);
    return { ok: true, id: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save.';
    return { ok: false, errors: { _form: message } };
  }
}

export async function updateAddressAction(
  locale: string,
  addressId: string,
  _prev: AddressFormResult | undefined,
  formData: FormData,
): Promise<AddressFormResult> {
  const session = await getCurrentCustomer();
  if (!session) {
    redirect(`/${locale}/login`);
  }
  const parsed = AddressFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, errors: collectErrors(parsed.error.issues) };
  }
  try {
    await updateAddress(session.email, addressId, parsed.data);
    revalidatePath(`/${locale}/account/addresses`);
    revalidatePath(`/${locale}/account/addresses/${addressId}`);
    return { ok: true, id: addressId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save.';
    return { ok: false, errors: { _form: message } };
  }
}

export async function deleteAddressAction(
  locale: string,
  addressId: string,
): Promise<void> {
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);
  await deleteAddress(session.email, addressId);
  revalidatePath(`/${locale}/account/addresses`);
}

export async function setDefaultAddressAction(
  locale: string,
  addressId: string,
): Promise<void> {
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);
  await setDefaultAddress(session.email, addressId);
  revalidatePath(`/${locale}/account/addresses`);
}
