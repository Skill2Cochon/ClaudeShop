import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookSubscription,
} from '@claudeshop/contracts/webhook';
import type { WebhookSubscriptionRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaWebhookSubscriptionRepository
  implements WebhookSubscriptionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<WebhookSubscription | null> {
    const row = await this.prisma.webhookSubscription.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: WebhookSubscription[]; total: number }> {
    const where = { tenantId };
    const [rows, total] = await Promise.all([
      this.prisma.webhookSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.webhookSubscription.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findActiveForEvent(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookSubscription[]> {
    // Postgres JSONB array containment is the right operator here, but Prisma's
    // string[] helper isn't available on Json columns. Filter in SQL on
    // tenant + isActive then JSON-narrow in JS — the active set per tenant
    // is small (typically < 50 endpoints).
    const rows = await this.prisma.webhookSubscription.findMany({
      where: { tenantId, isActive: true },
    });
    return rows.map(toDomain).filter((s) => s.events.includes(eventType));
  }

  async create(
    tenantId: string,
    input: CreateWebhookSubscriptionInput & { secret: string },
  ): Promise<WebhookSubscription> {
    const row = await this.prisma.webhookSubscription.create({
      data: {
        tenantId,
        url: input.url,
        secret: input.secret,
        events: input.events,
        isActive: input.isActive ?? true,
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Webhook subscription ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.url !== undefined) data.url = input.url;
    if (input.secret !== undefined) data.secret = input.secret;
    if (input.events !== undefined) data.events = input.events;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    const row = await this.prisma.webhookSubscription.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.webhookSubscription.delete({ where: { id } });
  }
}

function toDomain(row: Row): WebhookSubscription {
  const events = Array.isArray(row.events)
    ? row.events.filter((e): e is string => typeof e === 'string')
    : [];
  return {
    id: row.id,
    tenantId: row.tenantId,
    url: row.url,
    secret: row.secret,
    events,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
