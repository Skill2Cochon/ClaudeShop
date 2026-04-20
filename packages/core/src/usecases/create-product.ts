import { CreateProductInputSchema, type CreateProductInput, type Product } from '@claudeshop/contracts/product';
import { ConflictError, ValidationError } from '@claudeshop/errors';
import type { ProductRepository } from '../ports/product-repository';
import type { Clock } from '../ports/clock';

export interface CreateProductDeps {
  tenantId: string;
  repo: ProductRepository;
  clock: Clock;
}

/**
 * Create a product in the current tenant's scope.
 *
 * Contract:
 * - Input is validated via Zod; invalid shapes throw ValidationError.
 * - Slug must be unique within the tenant; collision throws ConflictError.
 * - The repository is responsible for persistence; this use-case is transactional
 *   at the domain level (check-then-insert).
 */
export async function createProduct(
  input: CreateProductInput,
  deps: CreateProductDeps,
): Promise<Product> {
  const parsed = CreateProductInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid product input', { details: parsed.error.issues });
  }

  const existing = await deps.repo.findBySlug(deps.tenantId, parsed.data.slug);
  if (existing) {
    throw new ConflictError(`Product with slug "${parsed.data.slug}" already exists`, {
      details: { slug: parsed.data.slug, existingId: existing.id },
    });
  }

  return deps.repo.create(deps.tenantId, parsed.data);
}
