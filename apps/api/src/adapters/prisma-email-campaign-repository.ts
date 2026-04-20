import type {
  CreateEmailCampaignInput,
  EmailCampaign,
  EmailCampaignStatus,
  UpdateEmailCampaignInput,
} from '@claudeshop/contracts/crm';
import type { EmailCampaignRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  bodyMd: string;
  segmentId: string | null;
  status: EmailCampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaEmailCampaignRepository implements EmailCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<EmailCampaign | null> {
    const row = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toDomain(row);
  }

  async list(
    tenantId: string,
    opts: { page: number; limit: number; status?: EmailCampaignStatus },
  ): Promise<{ items: EmailCampaign[]; total: number }> {
    const where = {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.emailCampaign.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.emailCampaign.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async create(
    tenantId: string,
    input: CreateEmailCampaignInput,
  ): Promise<EmailCampaign> {
    const row = await this.prisma.emailCampaign.create({
      data: {
        tenantId,
        name: input.name,
        subject: input.subject,
        bodyMd: input.bodyMd,
        segmentId: input.segmentId ?? null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
    return toDomain(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateEmailCampaignInput,
  ): Promise<EmailCampaign> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Campaign ${id} not found`);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.bodyMd !== undefined) data.bodyMd = input.bodyMd;
    if (input.segmentId !== undefined) data.segmentId = input.segmentId;
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    const row = await this.prisma.emailCampaign.update({ where: { id }, data });
    return toDomain(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return;
    await this.prisma.emailCampaign.delete({ where: { id } });
  }

  async finaliseSend(
    tenantId: string,
    id: string,
    patch: {
      status: EmailCampaignStatus;
      sentAt?: Date;
      sentCount: number;
      failedCount: number;
    },
  ): Promise<EmailCampaign> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Campaign ${id} not found`);
    const row = await this.prisma.emailCampaign.update({
      where: { id },
      data: {
        status: patch.status,
        sentCount: patch.sentCount,
        failedCount: patch.failedCount,
        ...(patch.sentAt ? { sentAt: patch.sentAt } : {}),
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: Row): EmailCampaign {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    subject: row.subject,
    bodyMd: row.bodyMd,
    segmentId: row.segmentId,
    status: row.status,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
