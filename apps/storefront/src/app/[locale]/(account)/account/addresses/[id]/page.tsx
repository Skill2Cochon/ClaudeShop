import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAddress } from '@/lib/api';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { AddressForm } from '../address-form';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Edit address',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditAddressPage({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  const address = await getAddress(session.email, id);
  if (!address) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account/addresses`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Address book
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          Edit {address.label ?? 'address'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Update the details below. The checkout form will pick up the new
          values on your next order.
        </p>
      </header>

      <AddressForm
        locale={locale}
        address={address}
        submitLabel="Save changes"
        cancelHref={`/${locale}/account/addresses`}
      />
    </main>
  );
}
