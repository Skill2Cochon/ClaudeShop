'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import {
  createWebhookAction,
  updateWebhookAction,
  type WebhookFormState,
} from './actions';

const INITIAL: WebhookFormState = { status: 'idle' };

const COMMON_EVENTS = [
  'order.placed',
  'order.paid',
  'order.shipped',
  'order.cancelled',
  'product.created',
  'product.updated',
  'product.deleted',
  'inventory.adjusted',
  'customer.created',
  'module.installed',
];

interface WebhookFormProps {
  webhookId?: string;
  initial?: {
    url: string;
    events: string[];
    isActive: boolean;
  };
}

export function WebhookForm({ webhookId, initial }: WebhookFormProps) {
  const isEdit = Boolean(webhookId);
  const bound = isEdit ? updateWebhookAction.bind(null, webhookId!) : createWebhookAction;
  const [state, formAction, isPending] = useActionState<WebhookFormState, FormData>(
    bound,
    INITIAL,
  );
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="url">Endpoint URL</Label>
        <input
          id="url"
          name="url"
          type="url"
          required
          defaultValue={initial?.url ?? ''}
          placeholder="https://your-system.example.com/webhooks/claudeshop"
          className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          ClaudeShop POSTs JSON here for every subscribed event.
        </p>
      </div>
      <div>
        <Label htmlFor="events">Events (comma-separated)</Label>
        <input
          id="events"
          name="events"
          required
          defaultValue={(initial?.events ?? ['order.placed']).join(', ')}
          className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Common: {COMMON_EVENTS.join(', ')}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="secret">Secret (HMAC signing key)</Label>
          <input
            id="secret"
            name="secret"
            placeholder={isEdit ? '(leave blank to keep current)' : '(auto-generated if blank)'}
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Used to sign the X-ClaudeShop-Signature header.
          </p>
        </div>
        <div>
          <Label htmlFor="isActive">Status</Label>
          <select
            id="isActive"
            name="isActive"
            defaultValue={initial?.isActive === false ? 'false' : 'true'}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="true">ACTIVE</option>
            <option value="false">PAUSED</option>
          </select>
        </div>
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
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create webhook'}
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
