import type { Payment, PaymentStatus } from '@claudeshop/contracts/order';
import type { CreatePaymentInput, PaymentRepository } from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';
import { NotFoundError } from '@claudeshop/errors';

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) return null;
    return toPayment(row);
  }

  async findByProviderRef(
    tenantId: string,
    provider: string,
    providerRef: string,
  ): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({
      where: { tenantId_provider_providerRef: { tenantId, provider, providerRef } },
    });
    return row ? toPayment(row) : null;
  }

  async findLatestForOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        orderId,
        status: { notIn: ['FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toPayment(row) : null;
  }

  async listByOrder(tenantId: string, orderId: string): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { tenantId, orderId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPayment);
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    // Upsert on idempotencyKey — retries with the same key return the same row.
    const row = await this.prisma.payment.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        provider: input.provider,
        providerRef: input.providerRef,
        status: input.status,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
      },
      update: {
        // Same-idempotency retry: provider may have returned a different
        // intent id if the first call partially failed. Update the ref
        // but leave status as-is (webhook is authoritative).
        providerRef: input.providerRef,
      },
    });
    return toPayment(row);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: PaymentStatus,
    capturedAt?: Date,
  ): Promise<Payment> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new NotFoundError(`Payment ${id} not found`);

    const row = await this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(capturedAt ? { capturedAt } : {}),
      },
    });
    return toPayment(row);
  }
}

type PrismaPaymentRow = NonNullable<
  Awaited<ReturnType<PrismaClient['payment']['findUnique']>>
>;

function toPayment(row: PrismaPaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    providerRef: row.providerRef,
    status: row.status,
    amount: row.amount.toString(),
    currency: row.currency,
    idempotencyKey: row.idempotencyKey,
    capturedAt: row.capturedAt ? row.capturedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
