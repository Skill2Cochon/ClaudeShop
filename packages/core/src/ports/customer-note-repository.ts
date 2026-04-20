import type {
  CustomerNote,
  CustomerNoteAuthorType,
} from '@claudeshop/contracts/customer';

export interface AppendCustomerNoteInput {
  customerId: string;
  authorType: CustomerNoteAuthorType;
  /** null for system-authored notes. */
  authorId: string | null;
  authorName: string;
  body: string;
}

export interface ListCustomerNotesOptions {
  page?: number;
  limit?: number;
}

/**
 * Phase 44 — merchant-facing CRM timeline. Pure append + list; same
 * forensic-append semantics as OrderNoteRepository so both surfaces
 * behave the same way.
 */
export interface CustomerNoteRepository {
  append(
    tenantId: string,
    input: AppendCustomerNoteInput,
  ): Promise<CustomerNote>;
  list(
    tenantId: string,
    customerId: string,
    opts?: ListCustomerNotesOptions,
  ): Promise<{ items: CustomerNote[]; total: number }>;
}
