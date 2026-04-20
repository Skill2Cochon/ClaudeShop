import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getCampaign, listSegments } from '@/lib/api';
import { CampaignForm } from '../campaign-form';
import { deleteCampaignAction, sendCampaignAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-sky-100 text-sky-900',
  SENDING: 'bg-yellow-100 text-yellow-900',
  SENT: 'bg-green-100 text-green-900',
  FAILED: 'bg-red-100 text-red-900',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const { items: segments } = await listSegments({ limit: 100 });

  const canSend = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/campaigns" className="text-xs text-muted-foreground hover:underline">
            ← All campaigns
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span
              className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[campaign.status] ?? ''}`}
            >
              {campaign.status}
            </span>
            {campaign.sentCount > 0
              ? `${campaign.sentCount} sent · ${campaign.failedCount} failed`
              : 'never sent'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canSend ? (
            <form
              action={async () => {
                'use server';
                await sendCampaignAction(id);
              }}
            >
              <Button type="submit" size="sm">
                Send now
              </Button>
            </form>
          ) : null}
          <form
            action={async () => {
              'use server';
              await deleteCampaignAction(id);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Delete
            </Button>
          </form>
        </div>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <CampaignForm
          campaignId={id}
          segments={segments.map((s) => ({
            id: s.id,
            name: s.name,
            customerCount: s.customerCount,
          }))}
          initial={{
            name: campaign.name,
            subject: campaign.subject,
            bodyMd: campaign.bodyMd,
            segmentId: campaign.segmentId,
          }}
        />
      </section>
    </div>
  );
}
