import { describe, expect, it, beforeEach } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@claudeshop/errors';
import type {
  CreatePageInput,
  Page,
  PageStatus,
  UpdatePageInput,
} from '@claudeshop/contracts/page';
import type { PageRepository } from '../ports/page-repository.js';
import type { Clock } from '../ports/clock.js';
import { createPage, updatePage, deletePage } from './manage-page.js';

class InMemoryPageRepository implements PageRepository {
  private readonly pages = new Map<string, Page>();
  private readonly slugIndex = new Map<string, string>();

  async findById(tenantId: string, id: string): Promise<Page | null> {
    const p = this.pages.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<Page | null> {
    const id = this.slugIndex.get(`${tenantId}:${slug}`);
    return id ? (this.pages.get(id) ?? null) : null;
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: PageStatus },
  ): Promise<{ items: Page[]; total: number }> {
    const all = [...this.pages.values()].filter(
      (p) => p.tenantId === tenantId && (!opts.status || p.status === opts.status),
    );
    const offset = (opts.page - 1) * opts.limit;
    return { items: all.slice(offset, offset + opts.limit), total: all.length };
  }

  async create(
    tenantId: string,
    input: CreatePageInput & { publishedAt?: Date },
  ): Promise<Page> {
    const id = `pg${Math.random().toString(36).slice(2, 24).padEnd(22, '0')}`;
    const now = new Date().toISOString();
    const page: Page = {
      id,
      tenantId,
      slug: input.slug,
      status: input.status,
      title: input.title,
      body: input.body,
      seo: input.seo ?? null,
      publishedAt: input.publishedAt ? input.publishedAt.toISOString() : null,
      authorId: input.authorId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.pages.set(id, page);
    this.slugIndex.set(`${tenantId}:${input.slug}`, id);
    return page;
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdatePageInput,
  ): Promise<Page> {
    const existing = this.pages.get(id);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error(`not found: ${id}`);
    }
    if (input.slug && input.slug !== existing.slug) {
      this.slugIndex.delete(`${tenantId}:${existing.slug}`);
      this.slugIndex.set(`${tenantId}:${input.slug}`, id);
    }
    const next: Page = {
      ...existing,
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.seo !== undefined ? { seo: input.seo ?? null } : {}),
      ...(input.authorId !== undefined ? { authorId: input.authorId ?? null } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (input.status === 'PUBLISHED' && !existing.publishedAt) {
      next.publishedAt = new Date().toISOString();
    }
    this.pages.set(id, next);
    return next;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const p = this.pages.get(id);
    if (!p || p.tenantId !== tenantId) return;
    this.slugIndex.delete(`${tenantId}:${p.slug}`);
    this.pages.delete(id);
  }
}

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

describe('createPage / updatePage / deletePage', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let repo: InMemoryPageRepository;
  const clock = new FixedClock(new Date('2026-04-19T09:00:00.000Z'));

  const draftInput: CreatePageInput = {
    slug: 'about',
    status: 'DRAFT',
    title: { en: 'About us', fr: 'À propos' },
    body: { en: '# Hello world', fr: '# Bonjour le monde' },
  };

  beforeEach(() => {
    repo = new InMemoryPageRepository();
  });

  describe('createPage', () => {
    it('creates a DRAFT page without a publishedAt timestamp', async () => {
      const page = await createPage(draftInput, { tenantId, repo, clock });
      expect(page.slug).toBe('about');
      expect(page.status).toBe('DRAFT');
      expect(page.publishedAt).toBeNull();
    });

    it('stamps publishedAt when status=PUBLISHED at create time', async () => {
      const page = await createPage(
        { ...draftInput, status: 'PUBLISHED' },
        { tenantId, repo, clock },
      );
      expect(page.status).toBe('PUBLISHED');
      expect(page.publishedAt).toBe('2026-04-19T09:00:00.000Z');
    });

    it('rejects duplicate slug in the same tenant', async () => {
      await createPage(draftInput, { tenantId, repo, clock });
      await expect(
        createPage(draftInput, { tenantId, repo, clock }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('allows the same slug in different tenants', async () => {
      await createPage(draftInput, { tenantId, repo, clock });
      const other = await createPage(draftInput, {
        tenantId: 'tnt02h0000000000000000000',
        repo,
        clock,
      });
      expect(other.tenantId).toBe('tnt02h0000000000000000000');
    });

    it('rejects invalid slugs via Zod', async () => {
      await expect(
        createPage(
          { ...draftInput, slug: 'Not Valid!' },
          { tenantId, repo, clock },
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('updatePage', () => {
    it('updates title/body fields', async () => {
      const created = await createPage(draftInput, { tenantId, repo, clock });
      const updated = await updatePage(
        created.id,
        { title: { en: 'About us — v2' } },
        { tenantId, repo, clock },
      );
      expect(updated.title.en).toBe('About us — v2');
    });

    it('promotes to PUBLISHED via `publish: true` shorthand', async () => {
      const created = await createPage(draftInput, { tenantId, repo, clock });
      const updated = await updatePage(
        created.id,
        { publish: true },
        { tenantId, repo, clock },
      );
      expect(updated.status).toBe('PUBLISHED');
      expect(updated.publishedAt).not.toBeNull();
    });

    it('rejects slug changes that collide with another page', async () => {
      await createPage(draftInput, { tenantId, repo, clock });
      const second = await createPage(
        { ...draftInput, slug: 'legal' },
        { tenantId, repo, clock },
      );
      await expect(
        updatePage(second.id, { slug: 'about' }, { tenantId, repo, clock }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('allows renaming to the same slug the page already has', async () => {
      const created = await createPage(draftInput, { tenantId, repo, clock });
      const updated = await updatePage(
        created.id,
        { slug: 'about' },
        { tenantId, repo, clock },
      );
      expect(updated.slug).toBe('about');
    });

    it('throws NotFoundError for a missing page', async () => {
      await expect(
        updatePage('pgMISSING', { title: { en: 'x' } }, { tenantId, repo, clock }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('deletePage', () => {
    it('removes the page and frees its slug', async () => {
      const created = await createPage(draftInput, { tenantId, repo, clock });
      await deletePage(created.id, { tenantId, repo });
      expect(await repo.findBySlug(tenantId, 'about')).toBeNull();
    });

    it('throws NotFoundError when the page does not exist', async () => {
      await expect(
        deletePage('pgGHOST', { tenantId, repo }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
