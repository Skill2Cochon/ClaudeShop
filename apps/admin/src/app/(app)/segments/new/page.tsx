import Link from 'next/link';
import { SegmentForm } from '../segment-form';

export const dynamic = 'force-dynamic';

export default function NewSegmentPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/segments" className="text-xs text-muted-foreground hover:underline">
          ← All segments
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New segment</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <SegmentForm />
      </section>
    </div>
  );
}
