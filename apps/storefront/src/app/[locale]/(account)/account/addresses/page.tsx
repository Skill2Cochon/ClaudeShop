import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { listAddresses } from '@/lib/api';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { deleteAddressAction, setDefaultAddressAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Address book',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Phase 50 — saved shipping addresses. Customers can add as many
 * as they want; the default one prefills the checkout form on the
 * next order. The default is shown first in the list and
 * highlighted with a "Default" chip.
 */
export default async function AddressBookPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const addresses = await listAddresses(session.email);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Account
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Address book</h1>
            <p className="text-sm text-muted-foreground">
              {addresses.length} saved address
              {addresses.length === 1 ? '' : 'es'} · your default prefills the
              checkout form.
            </p>
          </div>
          <Link href={`/${locale}/account/addresses/new`}>
            <Button size="sm">Add address</Button>
          </Link>
        </div>
      </header>

      {addresses.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          <p>No saved addresses yet.</p>
          <p className="mt-1">
            Add one now and the checkout form will prefill it on your next order.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => {
            const del = deleteAddressAction.bind(null, locale, a.id);
            const mkDefault = setDefaultAddressAction.bind(null, locale, a.id);
            return (
              <li
                key={a.id}
                className="rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {a.label ?? `${a.firstName} ${a.lastName}`}
                      </p>
                      {a.isDefault ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <address className="mt-2 whitespace-pre-line text-sm not-italic text-muted-foreground">
                      {formatAddress(a)}
                    </address>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <Link
                      href={`/${locale}/account/addresses/${encodeURIComponent(a.id)}`}
                      className="rounded-md border px-3 py-1.5 hover:bg-muted"
                    >
                      Edit
                    </Link>
                    {!a.isDefault ? (
                      <form action={mkDefault}>
                        <button
                          type="submit"
                          className="rounded-md border px-3 py-1.5 text-muted-foreground hover:bg-muted"
                        >
                          Make default
                        </button>
                      </form>
                    ) : null}
                    <form action={del}>
                      <button
                        type="submit"
                        className="rounded-md border border-destructive/30 px-3 py-1.5 text-destructive hover:bg-destructive/5"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function formatAddress(a: {
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string;
  country: string;
  phone: string | null;
}): string {
  const lines = [
    `${a.firstName} ${a.lastName}`,
    a.company,
    a.line1,
    a.line2,
    [a.city, a.region, a.postcode].filter(Boolean).join(', '),
    a.country,
    a.phone,
  ].filter(Boolean);
  return lines.join('\n');
}
