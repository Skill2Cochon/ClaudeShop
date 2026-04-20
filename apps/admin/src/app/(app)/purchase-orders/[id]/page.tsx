import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@claudeshop/ui';
import { getPurchaseOrder, getSupplier } from '@/lib/api';
import {
  cancelPurchaseOrderAction,
  receivePurchaseOrderAction,
  sendPurchaseOrderAction,
} from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-sky-100 text-sky-900',
  PARTIAL: 'bg-yellow-100 text-yellow-900',
  RECEIVED: 'bg-green-100 text-green-900',
  CANCELLED: 'bg-red-100 text-red-900',
};

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();
  const supplier = await getSupplier(po.supplierId);

  const canSend = po.status === 'DRAFT';
  const canCancel = po.status === 'DRAFT' || po.status === 'SENT';
  const canReceive = po.status === 'SENT' || po.status === 'PARTIAL';

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/purchase-orders"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All purchase orders
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">#{po.number}</h1>
          <p className="text-sm text-muted-foreground">
            Supplier:{' '}
            <Link
              href={`/suppliers/${encodeURIComponent(po.supplierId)}`}
              className="underline"
            >
              {supplier?.name ?? po.supplierId}
            </Link>
            {' · '}
            {po.lines.length} line{po.lines.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold">
              {po.total} {po.currency}
            </span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase ${STATUS_BADGE[po.status] ?? ''}`}
        >
          {po.status}
        </span>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        {canSend ? (
          <form
            action={async () => {
              'use server';
              await sendPurchaseOrderAction(id);
            }}
          >
            <Button type="submit" size="sm">
              Send to supplier
            </Button>
          </form>
        ) : null}
        {canCancel ? (
          <form
            action={async () => {
              'use server';
              await cancelPurchaseOrderAction(id);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Cancel
            </Button>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card">
        <header className="border-b p-4">
          <h2 className="text-base font-semibold">Lines</h2>
        </header>
        <ul className="divide-y">
          {po.lines.map((l) => {
            const remaining = l.qtyOrdered - l.qtyReceived;
            return (
              <li key={l.id} className="grid grid-cols-12 items-center gap-3 p-4 text-sm">
                <div className="col-span-4">
                  <p className="font-mono">{l.sku}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {l.variantId}
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-xs text-muted-foreground">Unit cost</p>
                  <p>{l.unitCost} {po.currency}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-xs text-muted-foreground">Ordered</p>
                  <p>{l.qtyOrdered}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-xs text-muted-foreground">Received</p>
                  <p>
                    <span
                      className={
                        l.qtyReceived >= l.qtyOrdered ? 'text-emerald-700' : ''
                      }
                    >
                      {l.qtyReceived}
                    </span>{' '}
                    / {l.qtyOrdered}
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className={remaining > 0 ? 'font-semibold' : 'text-muted-foreground'}>
                    {remaining}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canReceive ? (
        <section className="rounded-lg border bg-card p-5">
          <header className="mb-3">
            <h2 className="text-base font-semibold">Receive stock</h2>
            <p className="text-xs text-muted-foreground">
              Enter the quantity received per line. Inventory.onHand is incremented
              atomically when you submit.
            </p>
          </header>
          <form
            action={async (formData) => {
              'use server';
              await receivePurchaseOrderAction(id, formData);
            }}
            className="space-y-3"
          >
            {po.lines
              .filter((l) => l.qtyReceived < l.qtyOrdered)
              .map((l) => (
                <div key={l.id} className="grid grid-cols-12 items-center gap-3">
                  <label
                    htmlFor={`qty:${l.id}`}
                    className="col-span-8 font-mono text-xs"
                  >
                    {l.sku}{' '}
                    <span className="text-muted-foreground">
                      ({l.qtyReceived}/{l.qtyOrdered} received)
                    </span>
                  </label>
                  <input
                    id={`qty:${l.id}`}
                    name={`qty:${l.id}`}
                    type="number"
                    min={0}
                    max={l.qtyOrdered - l.qtyReceived}
                    placeholder="0"
                    className="col-span-4 rounded-md border bg-background p-2 text-right text-sm"
                  />
                </div>
              ))}
            <Button type="submit" size="sm">
              Receive
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
