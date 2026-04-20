import type { Product, CreateProductInput, UpdateProductInput } from '@claudeshop/contracts/product';

export interface ProductRepository {
  findById(tenantId: string, id: string): Promise<Product | null>;
  findBySlug(tenantId: string, slug: string): Promise<Product | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; status?: Product['status'] },
  ): Promise<{ items: Product[]; total: number }>;
  create(tenantId: string, input: CreateProductInput): Promise<Product>;
  update(tenantId: string, id: string, input: UpdateProductInput): Promise<Product>;
  archive(tenantId: string, id: string): Promise<void>;
}
