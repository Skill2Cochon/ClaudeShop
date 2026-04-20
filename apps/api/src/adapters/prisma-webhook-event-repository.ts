import type { WebhookEventRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';

/**
 * Postgres-backed WebhookEventRepository. Uniqueness is enforced at the
 * (provider, eventId) level by the DB index; duplicate inserts surface as
 * Prisma `P2002` which we translate to "already processed" semantics.
 */
export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async alreadyProcessed(provider: string, eventId: string): Promise<boolean> {
    const row = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
      select: { id: true },
    });
    return row !== null;
  }

  async recordProcessed(entry: {
    tenantId: string;
    provider: string;
    eventId: string;
    eventType: string;
    orderId?: string;
  }): Promise<void> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          tenantId: entry.tenantId,
          provider: entry.provider,
          eventId: entry.eventId,
          eventType: entry.eventType,
          orderId: entry.orderId ?? null,
        },
      });
    } catch (err) {
      // Treat P2002 unique-constraint as replay — caller checks
      // alreadyProcessed() before this, so this branch should be rare
      // (concurrent double-delivery).
      if (isPrismaKnownError(err) && err.code === 'P2002') {
        throw new WebhookEventAlreadyRecordedError(entry.provider, entry.eventId);
      }
      throw err;
    }
  }
}

export class WebhookEventAlreadyRecordedError extends Error {
  constructor(provider: string, eventId: string) {
    super(`Webhook event already processed: ${provider}/${eventId}`);
    this.name = 'WebhookEventAlreadyRecordedError';
  }
}

function isPrismaKnownError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string';
}
