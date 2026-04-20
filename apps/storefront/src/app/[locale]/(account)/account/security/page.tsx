import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { SecurityForm } from './security-form';

export const metadata: Metadata = {
  title: 'Security',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function SecurityPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (!session) redirect(`/${locale}/login`);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${locale}/account`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Change the password attached to <code>{session.email}</code>.
          Other devices will need the new password on their next sign-in.
        </p>
      </header>

      <SecurityForm locale={locale} />
    </main>
  );
}
