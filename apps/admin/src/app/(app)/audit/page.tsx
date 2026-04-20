import Link from 'next/link';
import { adminFetch } from '@/lib/server-fetch';

export const dynamic = 'force-dynamic';

type ActorType = 'user' | 'copilot' | 'system' | 'api-key';

interface AuditRow {
  id: string;
  tenantId: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

interface ListResponse {
  data: AuditRow[];
  meta: { page: number; limit: number; total: number };
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    actorType?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    since?: string;
    until?: string;
  }>;
}

async function fetchLogs(
  qs: Record<string, string | undefined>,
): Promise<ListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(qs)) {
    if (value !== undefined && value.length > 0) params.set(key, value);
  }
  if (!params.has('limit')) params.set('limit', '100');
  const res = await adminFetch(`/v1/admin/audit-logs?${params.toString()}`);
  if (!res.ok) return { data: [], meta: { page: 1, limit: 100, total: 0 } };
  return (await res.json()) as ListResponse;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = sp.page ?? '1';
  const qs = {
    page,
    actorType: sp.actorType,
    action: sp.action,
    resourceType: sp.resourceType,
    resourceId: sp.resourceId,
    since: sp.since,
    until: sp.until,
  } satisfies Record<string, string | undefined>;

  const { data, meta } = await fetchLogs(qs);

  const exportQs = new URLSearchParams();
  if (qs.actorType) exportQs.set('actorType', qs.actorType);
  if (qs.action) exportQs.set('action', qs.action);
  if (qs.resourceType) exportQs.set('resourceType', qs.resourceType);
  if (qs.resourceId) exportQs.set('resourceId', qs.resourceId);
  if (qs.since) exportQs.set('since', qs.since);
  if (qs.until) exportQs.set('until', qs.until);
  const exportHref = exportQs.toString()
    ? `/api/audit-logs/export?${exportQs.toString()}`
    : '/api/audit-logs/export';
  const exportDisabled = meta.total === 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Phase 22 · Append-only trail of every material mutation: logins, module
            lifecycle, inventory adjustments. Filter by actor, action or resource, then dive
            into the diff payload.
          </p>
        </div>
        {exportDisabled ? (
          <span className="inline-flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
            Export CSV (empty)
          </span>
        ) : (
          <a
            href={exportHref}
            className="inline-flex h-9 shrink-0 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            Export CSV
          </a>
        )}
      </header>

      <form
        action="/audit"
        method="GET"
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 lg:grid-cols-6"
      >
        <FilterSelect
          name="actorType"
          label="Actor"
          defaultValue={sp.actorType ?? ''}
          options={[
            { value: '', label: 'any' },
            { value: 'user', label: 'user' },
            { value: 'copilot', label: 'copilot' },
            { value: 'system', label: 'system' },
            { value: 'api-key', label: 'api-key' },
          ]}
        />
        <FilterInput
          name="action"
          label="Action"
          placeholder="module.install"
          defaultValue={sp.action ?? ''}
        />
        <FilterInput
          name="resourceType"
          label="Resource type"
          placeholder="variant, module_installation…"
          defaultValue={sp.resourceType ?? ''}
        />
        <FilterInput
          name="resourceId"
          label="Resource id"
          placeholder="cm…"
          defaultValue={sp.resourceId ?? ''}
        />
        <FilterInput
          name="since"
          label="Since (ISO)"
          placeholder="2026-04-19T00:00:00Z"
          defaultValue={sp.since ?? ''}
        />
        <FilterInput
          name="until"
          label="Until (ISO)"
          placeholder="2026-04-20T00:00:00Z"
          defaultValue={sp.until ?? ''}
        />
        <div className="md:col-span-3 lg:col-span-6 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Apply filters
          </button>
          <Link
            href="/audit"
            className="text-xs text-muted-foreground hover:underline"
          >
            Reset
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            {data.length} / {meta.total} events
          </span>
        </div>
      </form>

      {data.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          Nothing matches those filters yet. Try a wider time range or a different actor
          type.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <AuditRowCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterInput({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
      />
    </div>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AuditRowCard({ row }: { row: AuditRow }) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold uppercase ${actorClass(row.actorType)}`}
        >
          {row.actorType}
        </span>
        <code className="font-mono font-semibold">{row.action}</code>
        <span className="text-muted-foreground">→</span>
        <code className="font-mono text-muted-foreground">
          {row.resourceType}:{row.resourceId}
        </code>
        <span className="ml-auto text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      </div>
      {row.actorId || row.ip || row.requestId ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {row.actorId ? <>actor: <code>{row.actorId}</code> · </> : null}
          {row.ip ? <>ip: <code>{row.ip}</code> · </> : null}
          {row.requestId ? <>reqId: <code>{row.requestId}</code></> : null}
        </p>
      ) : null}
      {row.diff !== null && row.diff !== undefined ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
            diff
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
            {JSON.stringify(row.diff, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  );
}

function actorClass(actor: ActorType): string {
  switch (actor) {
    case 'user':
      return 'bg-sky-100 text-sky-900';
    case 'copilot':
      return 'bg-fuchsia-100 text-fuchsia-900';
    case 'api-key':
      return 'bg-amber-100 text-amber-900';
    case 'system':
    default:
      return 'bg-slate-200 text-slate-900';
  }
}
