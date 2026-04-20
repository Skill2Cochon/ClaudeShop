import Link from 'next/link';
import { SupplierForm } from '../supplier-form';

export const dynamic = 'force-dynamic';

export default function NewSupplierPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/suppliers" className="text-xs text-muted-foreground hover:underline">
          ← All suppliers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New supplier</h1>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <SupplierForm />
      </section>
    </div>
  );
}
