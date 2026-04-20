import type { TenantSettings } from '@claudeshop/contracts/tenant-settings';
import { adminFetch } from '@/lib/server-fetch';
import { updateSettingsAction } from './actions';

export const dynamic = 'force-dynamic';

async function fetchSettings(): Promise<TenantSettings | null> {
  const res = await adminFetch('/v1/admin/settings');
  if (!res.ok) return null;
  const body = (await res.json()) as { data: TenantSettings };
  return body.data;
}

export default async function SettingsPage() {
  const settings = await fetchSettings();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
          <p className="text-sm text-muted-foreground">
            Phase 23 · Currency, locales, and brand identity for this tenant. Changes are
            audited (see the Audit log) and picked up on the next storefront render.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href="/settings/email-templates"
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Email templates →
          </a>
          <a
            href="/settings/api-keys"
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            API keys →
          </a>
        </div>
      </header>

      {!settings ? (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          Could not load current settings. Check that the API is reachable and the tenant
          exists.
        </div>
      ) : (
        <form action={updateSettingsAction} className="space-y-6">
          <Section title="Commerce defaults">
            <Field
              name="currency"
              label="Currency"
              placeholder="EUR"
              defaultValue={settings.currency}
              hint="ISO-4217 three-letter code (EUR, USD, GBP…)."
              className="max-w-[160px] uppercase"
            />
            <Field
              name="defaultLocale"
              label="Default locale"
              placeholder="en"
              defaultValue={settings.defaultLocale}
              hint='BCP-47-lite — "en", "fr-FR", etc.'
              className="max-w-[160px]"
            />
            <Field
              name="locales"
              label="Locales (comma-separated)"
              placeholder="en,fr,de,es"
              defaultValue={settings.locales.join(',')}
              hint="Up to 12. The default locale must be in this list."
            />
          </Section>

          <Section title="Brand identity">
            <Field
              name="brand.name"
              label="Brand name"
              placeholder="ClaudeShop"
              defaultValue={settings.brand.name}
              hint="Shown in the storefront header and transactional emails."
            />
            <Field
              name="brand.tagline"
              label="Tagline"
              placeholder="Headless commerce, re-imagined for 2026."
              defaultValue={settings.brand.tagline ?? ''}
            />
            <Field
              name="brand.logoUrl"
              label="Logo URL"
              placeholder="https://cdn.example.com/logo.svg"
              defaultValue={settings.brand.logoUrl ?? ''}
            />
            <Field
              name="brand.primaryColor"
              label="Primary color"
              placeholder="#0ea5e9"
              defaultValue={settings.brand.primaryColor ?? ''}
              hint="Hex (#rgb or #rrggbb)."
              className="max-w-[160px] font-mono"
            />
          </Section>

          <Section title="Storefront">
            <Field
              name="storefront.heroHeadline"
              label="Hero headline"
              placeholder="Welcome"
              defaultValue={settings.storefront?.heroHeadline ?? ''}
            />
            <Field
              name="storefront.heroTagline"
              label="Hero tagline"
              placeholder="Short sentence under the headline."
              defaultValue={settings.storefront?.heroTagline ?? ''}
            />
            <Field
              name="storefront.supportEmail"
              label="Support email"
              placeholder="support@example.com"
              defaultValue={settings.storefront?.supportEmail ?? ''}
            />
            <Field
              name="storefront.publicUrl"
              label="Public URL"
              placeholder="https://shop.example.com"
              defaultValue={settings.storefront?.publicUrl ?? ''}
              hint="Canonical origin for SEO + email links. No trailing slash."
            />
          </Section>

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">
              Only non-empty values are sent — partial updates are merged server-side.
            </span>
            <button
              type="submit"
              className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
            >
              Save settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  hint,
  className,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm ${className ?? ''}`}
      />
      {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
