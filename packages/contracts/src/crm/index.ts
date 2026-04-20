import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema } from '../common/primitives.js';
import { CustomerGroupSchema } from '../customer/index.js';

// --- Segment rules -------------------------------------------------------

/**
 * Phase 11 ships a small, hand-rolled rule shape. Keeping it explicit (vs.
 * a generic AST) makes the admin form trivial and the evaluation safe —
 * no eval, no SQL injection vector through `rules`.
 */
export const SegmentRuleSchema = z.object({
  customerGroup: CustomerGroupSchema.optional(),
  acceptsMarketing: z.boolean().optional(),
  hasOrdered: z.boolean().optional(),
  /** Money in minor units. */
  minLifetimeValueCents: z.number().int().min(0).optional(),
  /** Customer created in the last N days. */
  createdWithinDays: z.number().int().positive().max(3650).optional(),
});
export type SegmentRule = z.infer<typeof SegmentRuleSchema>;

// --- Customer segment ---------------------------------------------------

export const CustomerSegmentSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  rules: SegmentRuleSchema,
  customerCount: z.number().int().min(0),
  refreshedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;

export const CreateSegmentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  rules: SegmentRuleSchema.optional(),
});
export type CreateSegmentInput = z.infer<typeof CreateSegmentInputSchema>;

export const UpdateSegmentInputSchema = CreateSegmentInputSchema.partial();
export type UpdateSegmentInput = z.infer<typeof UpdateSegmentInputSchema>;

// --- Email campaign -----------------------------------------------------

export const EmailCampaignStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
]);
export type EmailCampaignStatus = z.infer<typeof EmailCampaignStatusSchema>;

export const EmailCampaignSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  bodyMd: z.string().min(1),
  segmentId: CuidSchema.nullable(),
  status: EmailCampaignStatusSchema,
  scheduledAt: IsoDateTimeSchema.nullable(),
  sentAt: IsoDateTimeSchema.nullable(),
  sentCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type EmailCampaign = z.infer<typeof EmailCampaignSchema>;

export const CreateEmailCampaignInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  bodyMd: z.string().trim().min(1).max(50_000),
  segmentId: CuidSchema.optional(),
  scheduledAt: IsoDateTimeSchema.optional(),
});
export type CreateEmailCampaignInput = z.infer<typeof CreateEmailCampaignInputSchema>;

export const UpdateEmailCampaignInputSchema = CreateEmailCampaignInputSchema.partial();
export type UpdateEmailCampaignInput = z.infer<typeof UpdateEmailCampaignInputSchema>;
