import {
  CreatePageInputSchema,
  UpdatePageInputSchema,
  type CreatePageInput,
  type Page,
  type UpdatePageInput,
} from '@claudeshop/contracts/page';
import { ConflictError, NotFoundError, ValidationError } from '@claudeshop/errors';
import type { PageRepository } from '../ports/page-repository';
import type { Clock } from '../ports/clock';

export interface CreatePageDeps {
  tenantId: string;
  repo: PageRepository;
  clock: Clock;
}

/**
 * Create a new CMS page. If status=PUBLISHED, stamps publishedAt now.
 * Slug must be unique within the tenant — duplicates throw ConflictError.
 */
export async function createPage(
  input: CreatePageInput,
  deps: CreatePageDeps,
): Promise<Page> {
  const parsed = CreatePageInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid page input', { details: parsed.error.issues });
  }

  const existing = await deps.repo.findBySlug(deps.tenantId, parsed.data.slug);
  if (existing) {
    throw new ConflictError(`Page with slug "${parsed.data.slug}" already exists`, {
      details: { slug: parsed.data.slug, existingId: existing.id },
    });
  }

  const publishedAt = parsed.data.status === 'PUBLISHED' ? deps.clock.now() : undefined;
  return deps.repo.create(deps.tenantId, {
    ...parsed.data,
    ...(publishedAt ? { publishedAt } : {}),
  });
}

export interface UpdatePageDeps {
  tenantId: string;
  repo: PageRepository;
  clock: Clock;
}

/**
 * Partial update of a CMS page.
 *
 * - `publish: true` shorthand promotes status → PUBLISHED and stamps publishedAt.
 * - Changing slug to a value already used by another page throws ConflictError.
 */
export async function updatePage(
  id: string,
  input: UpdatePageInput,
  deps: UpdatePageDeps,
): Promise<Page> {
  const parsed = UpdatePageInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid page update', { details: parsed.error.issues });
  }

  const existing = await deps.repo.findById(deps.tenantId, id);
  if (!existing) throw new NotFoundError(`Page ${id} not found`);

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const collision = await deps.repo.findBySlug(deps.tenantId, parsed.data.slug);
    if (collision && collision.id !== id) {
      throw new ConflictError(`Page with slug "${parsed.data.slug}" already exists`, {
        details: { slug: parsed.data.slug, existingId: collision.id },
      });
    }
  }

  const { publish, ...rest } = parsed.data;
  const patch: UpdatePageInput = { ...rest };
  if (publish === true) {
    patch.status = 'PUBLISHED';
  }

  return deps.repo.update(deps.tenantId, id, patch);
}

export interface DeletePageDeps {
  tenantId: string;
  repo: PageRepository;
}

export async function deletePage(id: string, deps: DeletePageDeps): Promise<void> {
  const existing = await deps.repo.findById(deps.tenantId, id);
  if (!existing) throw new NotFoundError(`Page ${id} not found`);
  await deps.repo.delete(deps.tenantId, id);
}
