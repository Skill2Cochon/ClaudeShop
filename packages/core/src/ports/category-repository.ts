import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@claudeshop/contracts/category';
import type { Product } from '@claudeshop/contracts/product';

export interface CategoryRepository {
  findById(tenantId: string, id: string): Promise<Category | null>;
  findBySlug(tenantId: string, slug: string): Promise<Category | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean; parentId?: string | null },
  ): Promise<{ items: Category[]; total: number }>;
  create(tenantId: string, input: CreateCategoryInput): Promise<Category>;
  update(tenantId: string, id: string, input: UpdateCategoryInput): Promise<Category>;
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * ACTIVE products in a given category (storefront-facing). Pagination is
   * built in so deep categories don't return everything.
   */
  listProducts(
    tenantId: string,
    categoryId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: Product[]; total: number }>;
}
