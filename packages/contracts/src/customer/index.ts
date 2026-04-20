import { z } from 'zod';
import {
  CuidSchema,
  EmailSchema,
  CountryCodeSchema,
  IsoDateTimeSchema,
} from '../common/primitives';

export const AddressSchema = z.object({
  id: CuidSchema,
  customerId: CuidSchema,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  company: z.string().max(120).nullable(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).nullable(),
  zip: z.string().min(1).max(20),
  country: CountryCodeSchema,
  phone: z.string().max(40).nullable(),
  isDefaultBilling: z.boolean().default(false),
  isDefaultShipping: z.boolean().default(false),
});

export const CustomerGroupSchema = z.enum(['B2C', 'B2B', 'VIP']);

export const CustomerSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  email: EmailSchema,
  phone: z.string().max(40).nullable(),
  firstName: z.string().max(80).nullable(),
  lastName: z.string().max(80).nullable(),
  group: CustomerGroupSchema.default('B2C'),
  acceptsMarketing: z.boolean().default(false),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateCustomerInputSchema = CustomerSchema.pick({
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  group: true,
  acceptsMarketing: true,
});

export type Customer = z.infer<typeof CustomerSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type CustomerGroup = z.infer<typeof CustomerGroupSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

/**
 * Phase 44 — merchant-facing CRM timeline. Same shape + semantics as
 * OrderNote (Phase 42) but keyed by customerId. 'user' notes are
 * typed by staff, 'system' notes are written by the API during
 * lifecycle events (first order placed, segment membership change,
 * support escalation). Append-only.
 */
export const CustomerNoteAuthorTypeSchema = z.enum(['user', 'system']);
export const CustomerNoteSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  customerId: CuidSchema,
  authorType: CustomerNoteAuthorTypeSchema,
  authorId: CuidSchema.nullable(),
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  createdAt: IsoDateTimeSchema,
});

export const CreateCustomerNoteInputSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type CustomerNoteAuthorType = z.infer<typeof CustomerNoteAuthorTypeSchema>;
export type CustomerNote = z.infer<typeof CustomerNoteSchema>;
export type CreateCustomerNoteInput = z.infer<typeof CreateCustomerNoteInputSchema>;

/**
 * Phase 50 — customer-facing saved shipping address. Field set
 * mirrors the Phase 35 guest-checkout ShippingAddress so prefill
 * into the checkout form is a zero-transform copy. `label` is free
 * text ("Home", "Office"), `isDefault` marks the single default
 * address the checkout uses on first paint.
 */
export const CustomerAddressSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  customerId: CuidSchema,
  label: z.string().max(40).nullable(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  company: z.string().max(120).nullable(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).nullable(),
  postcode: z.string().min(1).max(40),
  country: z.string().length(2).regex(/^[A-Z]{2}$/),
  phone: z.string().max(40).nullable(),
  isDefault: z.boolean().default(false),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateCustomerAddressInputSchema = z.object({
  label: z.string().trim().max(40).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().max(120).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional(),
  postcode: z.string().trim().min(1).max(40),
  country: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  phone: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

export const UpdateCustomerAddressInputSchema =
  CreateCustomerAddressInputSchema.partial();

export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;
export type CreateCustomerAddressInput = z.infer<
  typeof CreateCustomerAddressInputSchema
>;
export type UpdateCustomerAddressInput = z.infer<
  typeof UpdateCustomerAddressInputSchema
>;
