import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema } from '../common/primitives.js';

export const ReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  productId: CuidSchema,
  customerId: CuidSchema.nullable(),
  authUserId: CuidSchema.nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string().nullable(),
  status: ReviewStatusSchema,
  authorName: z.string().min(1).max(120),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  approvedAt: IsoDateTimeSchema.nullable(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const CreateReviewInputSchema = z.object({
  productId: CuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5_000).optional(),
  authorName: z.string().trim().min(1).max(120),
  customerId: CuidSchema.optional(),
  authUserId: CuidSchema.optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;

export const ReviewSummarySchema = z.object({
  productId: CuidSchema,
  count: z.number().int().min(0),
  averageRating: z.number().min(0).max(5),
  /** Counts per star rating (1..5). */
  histogram: z.record(z.number().int().min(0)),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
