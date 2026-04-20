import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getSegment } from '@/lib/api';
import { SegmentForm } from '../segment-form';
import { deleteSegmentAction, refreshSegmentAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSegmentPage({ params }: Props) {
  const { id } = await params;
  const segment = await getSegment(id);
  if (!segment) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/segments" className="text-xs text-muted-foreground hover:underline">
            ← All segments
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{segment.name}</h1>
          <p className="text-sm text-muted-foreground">
            {segment.customerCount} customer{segment.customerCount === 1 ? '' : 's'} match
            {segment.refreshedAt
              ? ` · last refreshed ${new Date(segment.refreshedAt).toLocaleString()}`
              : ' · never refreshed'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form
            action={async () => {
              'use server';
              await refreshSegmentAction(id);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Refresh count
            </Button>
          </form>
          <form
            action={async () => {
              'use server';
              await deleteSegmentAction(id);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Delete
            </Button>
          </form>
        </div>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <SegmentForm
          segmentId={id}
          initial={{
            name: segment.name,
            description: segment.description,
            rules: segment.rules,
          }}
        />
      </section>
    </div>
  );
}
