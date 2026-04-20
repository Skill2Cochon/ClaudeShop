import type {
  OrderNote,
  OrderNoteAuthorType,
} from '@claudeshop/contracts/order';
import type {
  AppendOrderNoteInput,
  ListOrderNotesOptions,
  OrderNoteRepository,
} from '@claudeshop/core';
import type { PrismaClient } from '@claudeshop/db';

type Row = {
  id: string;
  tenantId: string;
  orderId: string;
  authorType: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: Date;
};

export class PrismaOrderNoteRepository implements OrderNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(
    tenantId: string,
    input: AppendOrderNoteInput,
  ): Promise<OrderNote> {
    const row = await this.prisma.orderNote.create({
      data: {
        tenantId,
        orderId: input.orderId,
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
    orderId: string,
    opts: ListOrderNotesOptions = {},
  ): Promise<{ items: OrderNote[]; total: number }> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 100;
    const where = { tenantId, orderId };
    const [rows, total] = await Promise.all([
      this.prisma.orderNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.orderNote.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }
}

function toDomain(row: Row): OrderNote {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orderId: row.orderId,
    // `authorType` is a plain string at the DB layer but our contract
    // narrows it — trust the writer for now, the API route is the
    // only caller and it's typed via Zod on input.
    authorType: row.authorType as OrderNoteAuthorType,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
