import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Phase 60 — same rationale as (account)/account/login/page.tsx.
 * Redirect to the canonical /<locale>/register.
 */
export default async function AccountRegisterRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/register`);
}
