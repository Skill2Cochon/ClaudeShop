import Link from 'next/link';
import { listSegments } from '@/lib/api';
import { CampaignForm } from '../campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const { items: segments } = await listSegments({ limit: 100 });
  return (
    <div className="space-y-4">
      <header>
        <Link href="/campaigns" className="text-xs text-muted-foreground hover:underline">
          ← All campaigns
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New campaign</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        {segments.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            You need at least one segment to send a campaign.{' '}
            <Link href="/segments/new" className="underline">Create one first.</Link>
          </div>
        ) : (
          <CampaignForm
            segments={segments.map((s) => ({
              id: s.id,
              name: s.name,
              customerCount: s.customerCount,
            }))}
          />
        )}
      </section>
    </div>
  );
}
