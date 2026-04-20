import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getTaxRate } from '@/lib/api';
import { TaxRateForm } from '../tax-rate-form';
import { deleteTaxRateAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTaxRatePage({ params }: Props) {
  const { id } = await params;
  const rate = await getTaxRate(id);
  if (!rate) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link
            href="/tax-rates"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All tax rates
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{rate.name}</h1>
          <p className="text-sm text-muted-foreground">
            {(rate.rateBp / 100).toFixed(2)}% · {rate.countryCode}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deleteTaxRateAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <TaxRateForm
          taxRateId={id}
          initial={{
            name: rate.name,
            countryCode: rate.countryCode,
            regionCode: rate.regionCode,
            postcodePattern: rate.postcodePattern,
            rateBp: rate.rateBp,
            priority: rate.priority,
            isActive: rate.isActive,
          }}
        />
      </section>
    </div>
  );
}
