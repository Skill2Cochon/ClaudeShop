import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { listInstalledModules } from '@/lib/api';
import { installModuleAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ModuleConfigurePage({ params }: Props) {
  const { id } = await params;
  const moduleId = decodeURIComponent(id);

  if (moduleId !== '@claudeshop/payment-stripe') {
    // Only Stripe has a Phase 3.1 settings form. Other modules fall back to
    // generic JSON editor (Phase 3.2 per-module schemas).
    notFound();
  }

  const installations = await listInstalledModules();
  const existing = installations.find((i) => i.moduleId === moduleId);
  const settings = (existing?.settings ?? {}) as {
    mode?: string;
    secretKey?: string;
    webhookSecret?: string;
    publishableKey?: string;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-muted-foreground">
        <Link href="/modules" className="hover:underline">
          Modules
        </Link>
        <span className="mx-2">·</span>
        <span>{moduleId}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Stripe Payments</h1>
        <p className="text-sm text-muted-foreground">
          Configure Stripe API keys for this tenant. Test keys (<code>sk_test_…</code>) are
          recommended until you&apos;re ready to accept live payments.
        </p>
      </header>

      {existing ? (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Current installation</p>
          <dl className="mt-3 space-y-1.5 text-xs">
            <InfoRow label="Status" value={existing.status} />
            <InfoRow label="Version" value={existing.version} />
            <InfoRow label="Installed" value={new Date(existing.installedAt).toLocaleString()} />
            {existing.activatedAt ? (
              <InfoRow label="Activated" value={new Date(existing.activatedAt).toLocaleString()} />
            ) : null}
            {existing.lastError ? (
              <InfoRow label="Last error" value={existing.lastError} mono />
            ) : null}
          </dl>
        </div>
      ) : null}

      <form
        action={async (formData) => {
          'use server';
          await installModuleAction(moduleId, formData);
        }}
        className="rounded-lg border bg-card p-6 space-y-4 text-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {existing ? 'Update settings' : 'Install & activate'}
        </h2>

        <Field
          name="secretKey"
          label="Stripe secret key"
          description="Server-side only. Starts with sk_test_ or sk_live_."
          placeholder="sk_test_…"
          type="password"
          defaultValue={settings.secretKey ?? ''}
          required
        />
        <Field
          name="webhookSecret"
          label="Webhook signing secret"
          description="From the Stripe dashboard → Developers → Webhooks. Starts with whsec_."
          placeholder="whsec_…"
          type="password"
          defaultValue={settings.webhookSecret ?? ''}
          required
        />
        <Field
          name="publishableKey"
          label="Publishable key"
          description="Safe to expose on the storefront. Starts with pk_test_ or pk_live_."
          placeholder="pk_test_…"
          defaultValue={settings.publishableKey ?? ''}
          required
        />

        <div className="space-y-1">
          <label htmlFor="mode" className="text-xs font-medium">
            Mode
          </label>
          <select
            id="mode"
            name="mode"
            defaultValue={settings.mode ?? 'test'}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background"
          >
            <option value="test">Test (recommended for onboarding)</option>
            <option value="live">Live (real money flows)</option>
          </select>
        </div>

        <input type="hidden" name="version" value="0.1.0" />

        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {existing ? 'Save & reactivate' : 'Install & activate'}
          </Button>
          <Link href="/modules">
            <Button type="button" size="sm" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      <footer className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Keys are stored in the <code>ModuleInstallation.settings</code> column. Phase 3.2 ships
        envelope encryption (per-tenant DEK, KEK in Coolify secret manager) so the DB dump
        doesn&apos;t leak your Stripe keys.
      </footer>
    </div>
  );
}

function Field({
  name,
  label,
  description,
  type = 'text',
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  description: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  );
}
