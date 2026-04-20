import Link from 'next/link';
import { ShippingRateForm } from '../shipping-rate-form';

export const dynamic = 'force-dynamic';

export default function NewShippingRatePage() {
  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/shipping-rates"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All shipping rates
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New shipping rate</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <ShippingRateForm />
      </section>
    </div>
  );
}
