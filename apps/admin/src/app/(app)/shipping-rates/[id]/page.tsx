import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getShippingRate } from '@/lib/api';
import { ShippingRateForm } from '../shipping-rate-form';
import { deleteShippingRateAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditShippingRatePage({ params }: Props) {
  const { id } = await params;
  const rate = await getShippingRate(id);
  if (!rate) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link
            href="/shipping-rates"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All shipping rates
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{rate.name}</h1>
          <p className="text-sm text-muted-foreground">
            {(rate.basePriceCents / 100).toFixed(2)} {rate.currency}
            {rate.estimatedDays ? ` · ${rate.estimatedDays} days` : ''}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deleteShippingRateAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <ShippingRateForm
          shippingRateId={id}
          initial={{
            name: rate.name,
            countryCodes: rate.countryCodes,
            currency: rate.currency,
            basePriceCents: rate.basePriceCents,
            minSubtotalCents: rate.minSubtotalCents,
            freeShippingAboveCents: rate.freeShippingAboveCents,
            estimatedDays: rate.estimatedDays,
            isActive: rate.isActive,
          }}
        />
      </section>
    </div>
  );
}
