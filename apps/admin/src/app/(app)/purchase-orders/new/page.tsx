import Link from 'next/link';
import { listSuppliers } from '@/lib/api';
import { POForm } from '../po-form';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage() {
  const { items: suppliers } = await listSuppliers({ limit: 100, isActive: true });
  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/purchase-orders"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All purchase orders
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New purchase order</h1>
        <p className="text-sm text-muted-foreground">
          Drafts a PO. Use Send → Receive to push it through the lifecycle.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-5">
        {suppliers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No active suppliers. <Link href="/suppliers/new" className="underline">Create one first.</Link>
          </div>
        ) : (
          <POForm
            suppliers={suppliers.map((s) => ({
              id: s.id,
              name: s.name,
              currency: s.currency,
            }))}
          />
        )}
      </section>
    </div>
  );
}
