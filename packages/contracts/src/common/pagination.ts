import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().max(80).optional(),
});

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const CursorPaginationMetaSchema = z.object({
  limit: z.number().int().min(1),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type CursorPaginationMeta = z.infer<typeof CursorPaginationMetaSchema>;

/** Helper to build an API envelope schema from any inner data schema. */
export function successEnvelope<T extends z.ZodTypeAny>(
  data: T,
  meta: z.ZodTypeAny = z.unknown().optional(),
) {
  return z.object({
    data,
    meta: meta.optional(),
  });
}
