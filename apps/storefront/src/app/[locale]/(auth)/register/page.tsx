import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getCurrentCustomer } from '@/lib/session';
import { RegisterFormClient } from '../auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create account' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CustomerRegisterPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getCurrentCustomer();
  if (session) redirect(`/${locale}/account`);

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center gap-6 p-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ClaudeShop
        </p>
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          One account, order history, saved addresses. Takes 20 seconds.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <RegisterFormClient locale={locale} />
      </section>
    </main>
  );
}
