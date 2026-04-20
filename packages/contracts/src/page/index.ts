import { z } from 'zod';
import {
  CuidSchema,
  IsoDateTimeSchema,
  SlugSchema,
} from '../common/primitives.js';
import { LocalizedStringSchema } from '../common/i18n.js';

export const PageStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type PageStatus = z.infer<typeof PageStatusSchema>;

export const PageSeoSchema = z.object({
  title: LocalizedStringSchema.optional(),
  description: LocalizedStringSchema.optional(),
});
export type PageSeo = z.infer<typeof PageSeoSchema>;

export const PageSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  slug: SlugSchema,
  status: PageStatusSchema,
  title: LocalizedStringSchema,
  body: LocalizedStringSchema,
  seo: PageSeoSchema.nullable(),
  publishedAt: IsoDateTimeSchema.nullable(),
  authorId: CuidSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Page = z.infer<typeof PageSchema>;

export const CreatePageInputSchema = PageSchema.pick({
  slug: true,
  status: true,
  title: true,
  body: true,
}).extend({
  seo: PageSeoSchema.optional(),
  authorId: CuidSchema.optional(),
});
export type CreatePageInput = z.infer<typeof CreatePageInputSchema>;

export const UpdatePageInputSchema = CreatePageInputSchema.partial().extend({
  publish: z.boolean().optional(),
});
export type UpdatePageInput = z.infer<typeof UpdatePageInputSchema>;
