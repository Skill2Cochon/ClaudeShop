import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { AddressForm } from '../address-form';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Add address',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function NewAddressPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account/addresses`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Address book
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add address</h1>
        <p className="text-sm text-muted-foreground">
          Save a shipping destination so it prefills the checkout form on your
          next order.
        </p>
      </header>

      <AddressForm
        locale={locale}
        submitLabel="Save address"
        cancelHref={`/${locale}/account/addresses`}
      />
    </main>
  );
}
