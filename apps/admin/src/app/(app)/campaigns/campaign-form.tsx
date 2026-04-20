'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createCampaignAction,
  updateCampaignAction,
  type CampaignFormState,
} from './actions';

const INITIAL: CampaignFormState = { status: 'idle' };

interface CampaignFormProps {
  campaignId?: string;
  segments: Array<{ id: string; name: string; customerCount: number }>;
  initial?: {
    name: string;
    subject: string;
    bodyMd: string;
    segmentId: string | null;
  };
}

export function CampaignForm({ campaignId, segments, initial }: CampaignFormProps) {
  const isEdit = Boolean(campaignId);
  const bound = isEdit ? updateCampaignAction.bind(null, campaignId!) : createCampaignAction;
  const [state, formAction, isPending] = useActionState<CampaignFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Name (internal)</Label>
          <input
            id="name"
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="Spring sale 2026"
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="segmentId">Target segment</Label>
          <select
            id="segmentId"
            name="segmentId"
            defaultValue={initial?.segmentId ?? ''}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="">— pick a segment —</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.customerCount})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <input
          id="subject"
          name="subject"
          required
          defaultValue={initial?.subject ?? ''}
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="bodyMd">Body (Markdown)</Label>
        <textarea
          id="bodyMd"
          name="bodyMd"
          required
          rows={12}
          defaultValue={initial?.bodyMd ?? '# Hi\n\nWrite your message here.'}
          className="mt-1 w-full rounded-md border bg-background p-3 font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Headings, **bold**, *italic*, `code`, [links](https://example.com) are
          rendered. The send pipeline turns it into HTML.
        </p>
      </div>

      {state.status === 'error' ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}
      {state.status === 'ok' ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create campaign'}
      </Button>
    </form>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </label>
  );
}
