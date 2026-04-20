import Link from 'next/link';
import { PageForm } from '../page-form';

export const dynamic = 'force-dynamic';

export default function NewPagePage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/pages" className="text-xs text-muted-foreground hover:underline">
          ← All pages
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New CMS page</h1>
        <p className="text-sm text-muted-foreground">
          Draft a new storefront page. Status=DRAFT keeps it invisible until you publish.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <PageForm />
      </section>
    </div>
  );
}
