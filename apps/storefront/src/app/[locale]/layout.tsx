import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { getSite, type Site } from '@/lib/site';
import { NewsletterForm } from '@/components/newsletter/newsletter-form';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [session, site] = await Promise.all([getCurrentCustomer(), getSite()]);
  const brandColor = site.brand.primaryColor;

  return (
    <>
      <Header
        locale={locale}
        site={site}
        session={session ? { email: session.email, displayName: session.displayName } : null}
      />
      {brandColor ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --brand-primary: ${brandColor}; }`,
          }}
        />
      ) : null}
      {children}
      <Footer locale={locale} site={site} />
    </>
  );
}

function Footer({ locale, site }: { locale: string; site: Site }) {
  const brandLabel = site.brand.name;
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-[1.5fr_1fr]">
        <div className="max-w-md">
          <NewsletterForm variant="full" source="footer" />
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-start justify-end gap-x-8 gap-y-3 text-xs text-muted-foreground"
        >
          <div>
            <p className="font-semibold text-foreground">Shop</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link href={`/${locale}/products`} className="hover:underline">
                  All products
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/track`} className="hover:underline">
                  Track an order
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">Account</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link href={`/${locale}/account`} className="hover:underline">
                  My account
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/account/addresses`}
                  className="hover:underline"
                >
                  Addresses
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-4 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} {brandLabel}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function Header({
  locale,
  site,
  session,
}: {
  locale: string;
  site: Site;
  session: { email: string; displayName: string | null } | null;
}) {
  const brandLabel = site.brand.name;
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80"
        >
          {site.brand.logoUrl ? (
            <img
              src={site.brand.logoUrl}
              alt={brandLabel}
              className="h-5 w-auto"
              loading="eager"
            />
          ) : null}
          <span>{brandLabel}</span>
        </Link>
        <Link
          href={`/${locale}/products`}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Shop
        </Link>
        <form
          action={`/${locale}/search`}
          className="flex flex-1 items-center gap-2"
        >
          <input
            name="q"
            type="search"
            placeholder="Search products — try 'soft cotton tee' or 'warm winter layer'"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Search
          </button>
        </form>
        <nav className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {session ? (
            <Link
              href={`/${locale}/account`}
              className="hover:text-foreground hover:underline"
            >
              {session.displayName ?? session.email}
            </Link>
          ) : (
            <>
              <Link
                href={`/${locale}/login`}
                className="hover:text-foreground hover:underline"
              >
                Sign in
              </Link>
              <span aria-hidden>·</span>
              <Link
                href={`/${locale}/register`}
                className="hover:text-foreground hover:underline"
              >
                Register
              </Link>
            </>
          )}
          <span aria-hidden>·</span>
          <Link href={`/${locale}/cart`} className="hover:text-foreground hover:underline">
            Cart
          </Link>
        </nav>
      </div>
    </header>
  );
}
