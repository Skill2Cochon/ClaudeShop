import Link from 'next/link';
import { PromotionForm } from '../promotion-form';

export const dynamic = 'force-dynamic';

export default function NewPromotionPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/promotions" className="text-xs text-muted-foreground hover:underline">
          ← All promotions
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New promotion</h1>
        <p className="text-sm text-muted-foreground">
          Issue a discount code. Customers type the code into their cart to apply.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <PromotionForm />
      </section>
    </div>
  );
}
