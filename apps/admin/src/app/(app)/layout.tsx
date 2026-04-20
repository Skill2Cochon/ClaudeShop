import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { logoutAction } from '../(auth)/login/actions';
import { CommandPalette } from './_palette/command-palette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-card px-4 py-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            ClaudeShop
          </p>
          <p className="text-lg font-semibold">Admin</p>
        </div>
        <nav className="space-y-1 text-sm">
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/copilot" label="Copilot" badge="AI" />
          <NavItem href="/products" label="Products" badge="AI" />
          <NavItem href="/inventory" label="Inventory" />
          <NavItem href="/orders" label="Orders" />
          <NavItem href="/customers" label="Customers" badge="CRM" />
          <NavItem href="/promotions" label="Promotions" />
          <NavItem href="/tax-rates" label="Tax rates" />
          <NavItem href="/shipping-rates" label="Shipping rates" />
          <NavItem href="/suppliers" label="Suppliers" badge="ERP" />
          <NavItem href="/purchase-orders" label="Purchase orders" badge="ERP" />
          <NavItem href="/segments" label="Segments" badge="CRM" />
          <NavItem href="/campaigns" label="Campaigns" badge="CRM" />
          <NavItem href="/reviews" label="Reviews" />
          <NavItem href="/pages" label="CMS pages" />
          <NavItem href="/webhooks" label="Webhooks" />
          <NavItem href="/modules" label="Modules" />
          <NavItem href="/audit" label="Audit log" />
          <NavItem href="/settings" label="Settings" />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
          <div className="text-sm text-muted-foreground">
            Phase 5 · Session auth
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              {session.displayName ?? session.email}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-semibold uppercase text-muted-foreground">
                {session.role}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

function NavItem({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
