import Link from 'next/link';
import { listApiKeys, revokeApiKeyAction } from './actions';
import { MintForm } from './mint-form';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  const rows = await listApiKeys();
  const active = rows.filter((r) => r.revokedAt === null);
  const revoked = rows.filter((r) => r.revokedAt !== null);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/settings" className="text-xs text-muted-foreground hover:underline">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Phase 33 · mint per-tenant keys for automation (n8n, Zapier, CI scripts).
          Callers send <code>x-api-key: cs_…</code> or <code>Authorization: Bearer cs_…</code>;
          the tenant is resolved server-side so they don't need to also send{' '}
          <code>x-tenant-id</code>. Revoked keys are rejected immediately.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3">
          <h2 className="text-base font-semibold">Mint a new key</h2>
          <p className="text-xs text-muted-foreground">
            The raw secret shows up exactly once — copy it into your secret manager
            before leaving this page.
          </p>
        </header>
        <MintForm />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3">
          <h2 className="text-base font-semibold">Active keys</h2>
          <p className="text-xs text-muted-foreground">
            {active.length} active key{active.length === 1 ? '' : 's'}.
          </p>
        </header>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active keys. Mint one above to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((row) => (
              <KeyRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 ? (
        <section className="rounded-lg border bg-card p-5">
          <header className="mb-3">
            <h2 className="text-base font-semibold">Revoked keys</h2>
            <p className="text-xs text-muted-foreground">
              Kept in the audit trail; the secrets no longer authenticate.
            </p>
          </header>
          <ul className="space-y-2">
            {revoked.map((row) => (
              <KeyRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KeyRow({ row }: { row: Awaited<ReturnType<typeof listApiKeys>>[number] }) {
  const revoked = row.revokedAt !== null;
  const revoke = revokeApiKeyAction.bind(null, row.id);
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded border p-3 text-xs ${
        revoked ? 'bg-muted/40 text-muted-foreground' : 'bg-background'
      }`}
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold">
          {row.prefix}…{' '}
          <span className="text-muted-foreground">· {row.name}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Created {new Date(row.createdAt).toLocaleString()}
          {row.lastUsedAt
            ? ` · last used ${new Date(row.lastUsedAt).toLocaleString()}`
            : ' · never used'}
          {row.scopes.length > 0 ? ` · scopes: ${row.scopes.join(', ')}` : ''}
          {row.revokedAt
            ? ` · revoked ${new Date(row.revokedAt).toLocaleString()}`
            : ''}
        </p>
      </div>
      <div className="ml-auto">
        {!revoked ? (
          <form action={revoke}>
            <button
              type="submit"
              className="rounded-md border border-destructive/40 bg-background px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
            >
              Revoke
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-900">
            revoked
          </span>
        )}
      </div>
    </li>
  );
}
