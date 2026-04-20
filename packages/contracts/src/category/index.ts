import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema, SlugSchema } from '../common/primitives';
import { LocalizedStringSchema } from '../common/i18n';

export const CategorySchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  parentId: CuidSchema.nullable(),
  slug: SlugSchema,
  name: LocalizedStringSchema,
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategoryInputSchema = CategorySchema.pick({
  slug: true,
  name: true,
  position: true,
  isActive: true,
  parentId: true,
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = CreateCategoryInputSchema.partial();
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

/**
 * A tree node — Category plus its children. Used by the admin tree view and
 * storefront navigation builders. Validation is shallow by default; use
 * `CategoryTreeNodeSchema.parse()` if you need runtime shape checks.
 */
export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

export const CategoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  CategorySchema.extend({
    children: z.array(CategoryTreeNodeSchema),
  }),
) as z.ZodType<CategoryTreeNode>;
