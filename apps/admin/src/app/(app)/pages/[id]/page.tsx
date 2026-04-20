import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getPageById } from '@/lib/api';
import { PageForm } from '../page-form';
import { deletePageAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: Props) {
  const { id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/pages" className="text-xs text-muted-foreground hover:underline">
            ← All pages
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Edit: /{page.slug}
          </h1>
          <p className="text-sm text-muted-foreground">
            Status: <code className="rounded bg-muted px-1.5 py-0.5">{page.status}</code>
            {page.publishedAt ? ` · Published ${new Date(page.publishedAt).toLocaleDateString()}` : null}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deletePageAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <PageForm
          pageId={id}
          initial={{
            slug: page.slug,
            status: page.status,
            title: page.title,
            body: page.body,
          }}
        />
      </section>
    </div>
  );
}
