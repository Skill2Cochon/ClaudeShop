import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getSupplier } from '@/lib/api';
import { SupplierForm } from '../supplier-form';
import { deleteSupplierAction } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: Props) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/suppliers" className="text-xs text-muted-foreground hover:underline">
            ← All suppliers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">
            {supplier.currency} · NET {supplier.paymentTermsDays}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await deleteSupplierAction(id);
          }}
        >
          <Button type="submit" size="sm" variant="outline">
            Delete
          </Button>
        </form>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <SupplierForm
          supplierId={id}
          initial={{
            name: supplier.name,
            contactEmail: supplier.contactEmail,
            phone: supplier.phone,
            currency: supplier.currency,
            paymentTermsDays: supplier.paymentTermsDays,
            notes: supplier.notes,
            isActive: supplier.isActive,
          }}
        />
      </section>
    </div>
  );
}
