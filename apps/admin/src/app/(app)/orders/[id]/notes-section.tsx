import { relativeTime } from '@claudeshop/ui';
import { listOrderNotes } from '@/lib/api';
import { appendOrderNoteAction } from './note-actions';

interface NotesSectionProps {
  orderId: string;
}

/**
 * Server component that loads + renders the order notes timeline and
 * hosts the append form. Renders `relative` timestamps (e.g. "2h ago")
 * server-side once rather than leaking a client component just for
 * date formatting.
 */
export async function NotesSection({ orderId }: NotesSectionProps) {
  const { items, total } = await listOrderNotes(orderId, { limit: 100 });
  const bound = appendOrderNoteAction.bind(null, orderId);

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Internal notes · {total}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Staff-only timeline. Customers never see these. Append-only — if
          you need to correct a note, add a new one referencing the previous.
        </p>
      </header>

      <form action={bound} className="border-b p-4">
        <label htmlFor="note-body" className="sr-only">
          New note
        </label>
        <textarea
          id="note-body"
          name="body"
          placeholder="Carrier called — delay 48h, refund 5 EUR shipping."
          required
          maxLength={4000}
          rows={3}
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Markdown not rendered. Line breaks are preserved.
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
          &quot;customer reached out on chat, promised shipping by Friday&quot;.
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

