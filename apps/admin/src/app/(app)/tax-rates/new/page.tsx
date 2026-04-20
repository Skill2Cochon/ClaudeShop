import Link from 'next/link';
import { TaxRateForm } from '../tax-rate-form';

export const dynamic = 'force-dynamic';

export default function NewTaxRatePage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/tax-rates" className="text-xs text-muted-foreground hover:underline">
          ← All tax rates
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New tax rate</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <TaxRateForm />
      </section>
    </div>
  );
}
