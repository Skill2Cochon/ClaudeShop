import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Phase 60 — /<locale>/account/login was 404 in v0.1 but the storefront
 * footer + various share-links pointed there. Redirect permanently to the
 * canonical /<locale>/login (same page, shorter path) rather than let a
 * user hit a dead-end.
 */
export default async function AccountLoginRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/login`);
}
