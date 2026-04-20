import { relativeTime } from '@claudeshop/ui';
import { listCustomerNotes } from '@/lib/api';
import { appendCustomerNoteAction } from './note-actions';

interface NotesSectionProps {
  customerId: string;
}

/**
 * Phase 44 — CRM timeline server component. Same shape as the Phase
 * 42 order notes section: load + render + append form with server-
 * side relative timestamps so there's no client hydration gap for
 * dates that change by the minute.
 */
export async function NotesSection({ customerId }: NotesSectionProps) {
  const { items, total } = await listCustomerNotes(customerId, { limit: 100 });
  const bound = appendCustomerNoteAction.bind(null, customerId);

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          CRM notes · {total}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Merchant-only timeline. Customers never see these. Good for
          &quot;VIP — handle with care&quot;, &quot;prefers Tuesday delivery&quot;,
          etc. Append-only; corrections are new notes.
        </p>
      </header>

      <form action={bound} className="border-b p-4">
        <label htmlFor="customer-note-body" className="sr-only">
          New note
        </label>
        <textarea
          id="customer-note-body"
          name="body"
          placeholder="B2B buyer for Acme Corp — needs invoice-based billing."
          required
          maxLength={4000}
          rows={3}
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Line breaks preserved. Markdown not rendered.
          </p>
          <button
            type="submit"
            className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Add note
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          No notes yet. The first one is usually something like
          &quot;introduced by Partner X&quot; or &quot;returned from churn
          campaign&quot;.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((note) => (
            <li key={note.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold">
                  {note.authorName}
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {note.authorType}
                  </span>
                </span>
                <span
                  className="text-muted-foreground"
                  title={new Date(note.createdAt).toLocaleString()}
                >
                  {relativeTime(note.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

