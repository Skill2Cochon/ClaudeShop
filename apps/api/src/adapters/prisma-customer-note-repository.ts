import type {
  CustomerNote,
  CustomerNoteAuthorType,
} from '@claudeshop/contracts/customer';
import type {
  AppendCustomerNoteInput,
  CustomerNoteRepository,
  ListCustomerNotesOptions,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';

type Row = {
  id: string;
  tenantId: string;
  customerId: string;
  authorType: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: Date;
};

export class PrismaCustomerNoteRepository implements CustomerNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(
    tenantId: string,
    input: AppendCustomerNoteInput,
  ): Promise<CustomerNote> {
    const row = await this.prisma.customerNote.create({
      data: {
        tenantId,
        customerId: input.customerId,
        authorType: input.authorType,
        authorId: input.authorId,
        authorName: input.authorName,
        body: input.body,
      },
    });
    return toDomain(row);
  }

  async list(
    tenantId: string,
    customerId: string,
    opts: ListCustomerNotesOptions = {},
  ): Promise<{ items: CustomerNote[]; total: number }> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 100;
    const where = { tenantId, customerId };
    const [rows, total] = await Promise.all([
      this.prisma.customerNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customerNote.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }
}

function toDomain(row: Row): CustomerNote {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    authorType: row.authorType as CustomerNoteAuthorType,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
