import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '@claudeshop/contracts/webhook';
import type {
  CreateWebhookDeliveryInput,
  RecordAttemptInput,
  WebhookDeliveryRepository,
} from '@claudeshop/core';
import type { PrismaClient, Prisma } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventType: string;
  eventId: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  deliveredAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

export class PrismaWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<WebhookDelivery | null> {
    const row = await this.prisma.webhookDelivery.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: WebhookDeliveryStatus;
      eventType?: string;
      subscriptionId?: string;
    },
  ): Promise<{ items: WebhookDelivery[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.eventType ? { eventType: opts.eventType } : {}),
      ...(opts.subscriptionId ? { subscriptionId: opts.subscriptionId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async upsert(
    tenantId: string,
    input: CreateWebhookDeliveryInput,
  ): Promise<{ delivery: WebhookDelivery; isNew: boolean }> {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: {
        subscriptionId_eventId: {
          subscriptionId: input.subscriptionId,
          eventId: input.eventId,
        },
      },
    });
    if (existing) return { delivery: toDomain(existing), isNew: false };

    const row = await this.prisma.webhookDelivery.create({
      data: {
        tenantId,
        subscriptionId: input.subscriptionId,
        eventType: input.eventType,
        eventId: input.eventId,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
    return { delivery: toDomain(row), isNew: true };
  }

  async recordAttempt(
    tenantId: string,
    id: string,
    attempt: RecordAttemptInput,
  ): Promise<WebhookDelivery> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Delivery ${id} not found`);
    const row = await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: attempt.status,
        attemptCount: { increment: 1 },
        lastAttemptAt: attempt.attemptedAt,
        ...(attempt.deliveredAt ? { deliveredAt: attempt.deliveredAt } : {}),
        ...(attempt.responseStatus !== undefined
          ? { responseStatus: attempt.responseStatus }
          : {}),
        ...(attempt.responseBody !== undefined
          ? { responseBody: attempt.responseBody }
          : {}),
        ...(attempt.errorMessage !== undefined
          ? { errorMessage: attempt.errorMessage }
          : {}),
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: Row): WebhookDelivery {
  return {
    id: row.id,
    tenantId: row.tenantId,
    subscriptionId: row.subscriptionId,
    eventType: row.eventType,
    eventId: row.eventId,
    payload: row.payload,
    status: row.status,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}
