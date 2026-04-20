import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { marked } from 'marked';
import { getPublishedPage } from '@/lib/api';
import { isLocale, resolveLocalized } from '@/lib/i18n';

// CMS pages at /<locale>/<slug>. The route is intentionally below
// /<locale>/p/<slug> (products) so both can coexist — "p" is a product
// prefix that a CMS slug can never collide with.

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const RESERVED_SLUGS = new Set([
  'p',
  'c',
  'cart',
  'order',
  'search',
  'account',
  'login',
  'register',
  'products',
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || RESERVED_SLUGS.has(slug)) return {};
  const page = await getPublishedPage(slug);
  if (!page) return { title: 'Not found' };
  const title = resolveLocalized(page.title, locale);
  const seoDescription = page.seo?.description
    ? resolveLocalized(page.seo.description, locale)
    : '';
  return {
    title,
    description: seoDescription.slice(0, 200),
    openGraph: { title, description: seoDescription.slice(0, 200) },
  };
}

export default async function CmsPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || RESERVED_SLUGS.has(slug)) notFound();

  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const title = resolveLocalized(page.title, locale);
  const bodyMd = resolveLocalized(page.body, locale);
  const html = marked.parse(bodyMd, { async: false }) as string;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          /{page.slug}
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight">{title}</h1>
      </header>
      <article
        className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-a:text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
