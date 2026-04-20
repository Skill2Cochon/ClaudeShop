import Link from 'next/link';
import { listCustomers } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface CustomersPageProps {
  searchParams?: Promise<{
    query?: string;
    group?: string;
    marketing?: string;
    page?: string;
  }>;
}

const GROUP_CLASS: Record<string, string> = {
  B2C: 'bg-slate-100 text-slate-800',
  B2B: 'bg-indigo-100 text-indigo-900',
  VIP: 'bg-amber-100 text-amber-900',
};

/**
 * Phase 34 — merchant-facing directory. The URL is the source of
 * truth: every filter is a querystring param so a merchant can deep-
 * link to "all VIPs who accept marketing" and hand it to the campaign
 * builder. No client-side state; the server component re-fetches on
 * every navigation.
 */
export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = (await searchParams) ?? {};
  const query = params.query?.trim() || undefined;
  const group =
    params.group === 'B2C' || params.group === 'B2B' || params.group === 'VIP'
      ? params.group
      : undefined;
  const acceptsMarketing =
    params.marketing === 'true'
      ? true
      : params.marketing === 'false'
        ? false
        : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  let items: Awaited<ReturnType<typeof listCustomers>>['items'] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const res = await listCustomers({
      page,
      limit: 50,
      ...(query ? { query } : {}),
      ...(group ? { group } : {}),
      ...(acceptsMarketing !== undefined ? { acceptsMarketing } : {}),
    });
    items = res.items;
    total = res.total;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load customers';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Phase 34 · {total.toLocaleString()} total · {items.length} shown.
            Filter by group, marketing opt-in, or free-text (email / first
            name / last name).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ExportCsvLink filters={params} disabled={total === 0} />
          <Link
            href="/segments"
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Segments →
          </Link>
        </div>
      </header>

      <form
        action="/customers"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 text-xs"
      >
        <label className="flex-1 min-w-[240px] space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Search
          </span>
          <input
            name="query"
            defaultValue={query ?? ''}
            placeholder="email, first or last name…"
            className="w-full rounded-md border bg-background px-2 py-1.5"
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Group
          </span>
          <select
            name="group"
            defaultValue={group ?? ''}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <option value="">All</option>
            <option value="B2C">B2C</option>
            <option value="B2B">B2B</option>
            <option value="VIP">VIP</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Marketing
          </span>
          <select
            name="marketing"
            defaultValue={params.marketing ?? ''}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <option value="">Any</option>
            <option value="true">Opted in</option>
            <option value="false">Opted out</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border bg-foreground px-3 py-1.5 font-semibold text-background hover:opacity-90"
        >
          Filter
        </button>
        <Link
          href="/customers"
          className="rounded-md border px-3 py-1.5 text-muted-foreground hover:bg-muted"
        >
          Reset
        </Link>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">API unreachable</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium">No customers match these filters.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            New customer rows land here automatically on first checkout or
            account registration.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Marketing</th>
                <th className="px-4 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((customer) => {
                const fullName = [customer.firstName, customer.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                return (
                  <tr key={customer.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {fullName || '(no name)'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {customer.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          GROUP_CLASS[customer.group] ?? 'bg-muted'
                        }`}
                      >
                        {customer.group}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {customer.acceptsMarketing ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                          Opted in
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          Opted out
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > items.length ? (
        <Pagination page={page} total={total} limit={50} params={params} />
      ) : null}
    </div>
  );
}

function ExportCsvLink({
  filters,
  disabled,
}: {
  filters: Record<string, string | undefined>;
  disabled: boolean;
}) {
  // The export endpoint accepts `query`, `group`, `acceptsMarketing`
  // (see admin-customers-export.ts). The page's `marketing` param
  // is a synonym of `acceptsMarketing` on the API side — mirror the
  // mapping we already use when hitting /v1/admin/customers so the
  // downloaded file matches what's on screen.
  const qp = new URLSearchParams();
  if (filters.query) qp.set('query', filters.query);
  if (filters.group) qp.set('group', filters.group);
  if (filters.marketing === 'true' || filters.marketing === 'false') {
    qp.set('acceptsMarketing', filters.marketing);
  }
  const href = qp.toString()
    ? `/api/customers/export?${qp.toString()}`
    : '/api/customers/export';

  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
        Export CSV (empty)
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
    >
      Export CSV
    </a>
  );
}

function Pagination({
  page,
  total,
  limit,
  params,
}: {
  page: number;
  total: number;
  limit: number;
  params: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const buildHref = (next: number): string => {
    const qp = new URLSearchParams();
    if (params.query) qp.set('query', params.query);
    if (params.group) qp.set('group', params.group);
    if (params.marketing) qp.set('marketing', params.marketing);
    qp.set('page', String(next));
    return `/customers?${qp.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            ← Prev
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={buildHref(page + 1)}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
