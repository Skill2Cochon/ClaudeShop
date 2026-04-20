import Link from 'next/link';
import { Button } from '@claudeshop/ui';
import { listInstalledModules, type ModuleInstallationRow } from '@/lib/api';
import { disableModuleAction, uninstallModuleAction } from './actions';

export const dynamic = 'force-dynamic';

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  trust: 'first-party' | 'verified' | 'community';
  permissions: string[];
}

const CATALOG: ModuleCard[] = [
  {
    id: '@claudeshop/payment-stripe',
    name: 'Stripe Payments',
    description:
      'Accept card + wallet payments via Stripe PaymentIntents. Apple Pay, Google Pay, Klarna, SEPA, iDEAL.',
    trust: 'first-party',
    permissions: ['order:read', 'order:write', 'payment:write', 'http:outbound:api.stripe.com'],
  },
];

const STATUS_STYLE: Record<ModuleInstallationRow['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-900',
  INSTALLED: 'bg-blue-100 text-blue-900',
  DISABLED: 'bg-muted text-muted-foreground',
  FAILED: 'bg-red-100 text-red-900',
};

const TRUST_STYLE: Record<ModuleCard['trust'], string> = {
  'first-party': 'bg-emerald-100 text-emerald-900',
  verified: 'bg-sky-100 text-sky-900',
  community: 'bg-yellow-100 text-yellow-900',
};

export default async function ModulesPage() {
  const installations = await listInstalledModules();
  const byId = new Map(installations.map((i) => [i.moduleId, i]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <p className="text-sm text-muted-foreground">
          Extend ClaudeShop — payments, shipping, AI, analytics. Install a module below to
          activate its provider. Phase 3.1 — DB-backed installations with per-tenant settings.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {CATALOG.map((m) => {
          const install = byId.get(m.id);
          return (
            <article
              key={m.id}
              className="rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-foreground/10"
            >
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{m.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    {m.id}
                    {install ? <span> · v{install.version}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {install ? (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[install.status]}`}
                    >
                      {install.status}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      not installed
                    </span>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TRUST_STYLE[m.trust]}`}
                  >
                    {m.trust}
                  </span>
                </div>
              </header>

              <p className="text-sm text-muted-foreground">{m.description}</p>

              {install?.lastError ? (
                <p className="mt-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  Last error: {install.lastError}
                </p>
              ) : null}

              <details className="mt-4 cursor-pointer">
                <summary className="text-xs font-medium text-muted-foreground">
                  Permissions ({m.permissions.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {m.permissions.map((p) => (
                    <li key={p} className="font-mono text-[11px] text-muted-foreground">
                      · {p}
                    </li>
                  ))}
                </ul>
              </details>

              <div className="mt-4 flex items-center gap-2">
                <Link href={`/modules/${encodeURIComponent(m.id)}`}>
                  <Button size="sm" variant={install ? 'outline' : 'default'}>
                    {install ? 'Configure' : 'Install'}
                  </Button>
                </Link>
                {install?.status === 'ACTIVE' ? (
                  <form
                    action={async () => {
                      'use server';
                      await disableModuleAction(m.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Disable
                    </Button>
                  </form>
                ) : null}
                {install ? (
                  <form
                    action={async () => {
                      'use server';
                      await uninstallModuleAction(m.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Uninstall
                    </Button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Phase 3.1: ModuleRegistry initialises at boot from ACTIVE ModuleInstallation rows.
        Dynamic imports per moduleId materialise the PaymentProvider; failures mark the row
        FAILED with the error message shown above. Phase 3.2 adds lifecycle hooks
        (onInstall/onMigrate/onActivate), capability enforcement, and worker isolation tiers.
      </footer>
    </div>
  );
}
