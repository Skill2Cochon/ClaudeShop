import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getPromotion } from '@/lib/api';
import { PromotionForm } from '../promotion-form';
import { deletePromotionAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPromotionPage({ params }: Props) {
  const { id } = await params;
  const promotion = await getPromotion(id);
  if (!promotion) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/promotions" className="text-xs text-muted-foreground hover:underline">
            ← All promotions
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {promotion.code}
          </h1>
          <p className="text-sm text-muted-foreground">
            {promotion.name} · {promotion.redemptionCount} redeemed
            {promotion.maxRedemptions ? ` / ${promotion.maxRedemptions}` : ''}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deletePromotionAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <PromotionForm
          promotionId={id}
          initial={{
            code: promotion.code,
            name: promotion.name,
            type: promotion.type,
            value: promotion.value,
            status: promotion.status,
            currency: promotion.currency,
            minSubtotalCents: promotion.minSubtotalCents,
            startsAt: promotion.startsAt,
            endsAt: promotion.endsAt,
            maxRedemptions: promotion.maxRedemptions,
          }}
        />
      </section>
    </div>
  );
}
