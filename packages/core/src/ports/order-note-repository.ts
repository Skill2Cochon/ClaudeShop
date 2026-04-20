import type {
  OrderNote,
  OrderNoteAuthorType,
} from '@claudeshop/contracts/order';

export interface AppendOrderNoteInput {
  orderId: string;
  authorType: OrderNoteAuthorType;
  /** null for system-authored notes. */
  authorId: string | null;
  /** Display name captured at write-time; shown verbatim on the timeline. */
  authorName: string;
  body: string;
}

export interface ListOrderNotesOptions {
  page?: number;
  limit?: number;
}

/**
 * Phase 42 — merchant-facing internal timeline. Pure append + list.
 * No update or delete: edits are new notes, and purging a note is a
 * forensic concern handled out-of-band (GDPR request → support ops).
 */
export interface OrderNoteRepository {
  append(tenantId: string, input: AppendOrderNoteInput): Promise<OrderNote>;
  list(
    tenantId: string,
    orderId: string,
    opts?: ListOrderNotesOptions,
  ): Promise<{ items: OrderNote[]; total: number }>;
}
