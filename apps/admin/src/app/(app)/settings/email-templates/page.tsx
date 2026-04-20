import Link from 'next/link';
import type { TenantSettings } from '@claudeshop/contracts/tenant-settings';
import type { Order } from '@claudeshop/contracts/order';
import type { InventoryProjection } from '@claudeshop/core';
import {
  renderLowStockDigest,
  renderOrderCancelled,
  renderOrderPlaced,
  renderOrderRefunded,
  renderOrderShipped,
  type BrandContext,
  type RenderedEmail,
} from '@claudeshop/core';
import { adminFetch } from '@/lib/server-fetch';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ active?: string }>;
}

/**
 * Phase 57 — transactional email preview. Every merchant eventually
 * asks "what does my shipped email actually look like?" and today
 * the answer is "run a test checkout and open your inbox". This
 * page renders each template with sample data (using the tenant's
 * real brand/settings when fetched, synthetic fallbacks otherwise)
 * so merchants can eyeball the HTML + plain-text variants
 * side-by-side without sending themselves anything.
 *
 * The iframe is sandboxed with srcDoc so the rendered HTML can't
 * navigate the admin away or exfiltrate the admin session.
 */
export default async function EmailTemplatesPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const settings = await fetchSettings();
  const brand = toBrandContext(settings);

  const sampleOrder = buildSampleOrder(settings?.currency ?? 'EUR');
  const sampleLowStock = buildSampleLowStock();
  const orderUrl =
    settings?.storefront?.publicUrl
      ? `${settings.storefront.publicUrl.replace(/\/$/, '')}/${settings.defaultLocale}/order/${sampleOrder.id}/confirmed`
      : undefined;
  const baseCtx = {
    brand,
    locale: settings?.defaultLocale ?? 'en',
    ...(orderUrl ? { orderUrl } : {}),
  };

  const templates: Array<{
    id: string;
    name: string;
    description: string;
    rendered: RenderedEmail;
  }> = [
    {
      id: 'order-placed',
      name: 'Order placed',
      description: 'Sent right after POST /v1/orders succeeds.',
      rendered: renderOrderPlaced(sampleOrder, baseCtx),
    },
    {
      id: 'order-shipped',
      name: 'Order shipped',
      description: 'Fires when the admin transitions an order to SHIPPED.',
      rendered: renderOrderShipped(sampleOrder, baseCtx),
    },
    {
      id: 'order-cancelled',
      name: 'Order cancelled',
      description: 'Fires when the admin transitions an order to CANCELLED.',
      rendered: renderOrderCancelled(sampleOrder, baseCtx),
    },
    {
      id: 'order-refunded',
      name: 'Order refunded',
      description: 'Fires when a full or partial refund is issued.',
      rendered: renderOrderRefunded(sampleOrder, {
        ...baseCtx,
        refundAmount: '42.00',
        isFullRefund: false,
        reason: 'damaged',
      }),
    },
    {
      id: 'low-stock-digest',
      name: 'Low-stock digest',
      description:
        'Manually triggered from /inventory or on a cron schedule.',
      rendered: renderLowStockDigest(sampleLowStock, {
        brand,
        ...(settings?.storefront?.publicUrl
          ? {
              inventoryUrl: `${settings.storefront.publicUrl.replace(/\/$/, '')}/admin/inventory`,
            }
          : {}),
      }),
    },
  ];

  const activeId = sp.active ?? templates[0]?.id ?? '';
  const active = templates.find((t) => t.id === activeId) ?? templates[0]!;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Settings · email
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Email templates
        </h1>
        <p className="text-sm text-muted-foreground">
          Phase 57 · Live previews of every transactional email, rendered
          against your tenant&apos;s brand settings.{' '}
          {settings ? (
            <span>
              Using <code className="rounded bg-muted px-1">{brand.name}</code>{' '}
              · locale{' '}
              <code className="rounded bg-muted px-1">
                {settings.defaultLocale}
              </code>
              .
            </span>
          ) : (
            <span className="text-destructive">
              Settings unreachable — showing synthetic brand fallbacks.
            </span>
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Select template"
          className="h-fit rounded-lg border bg-card p-2 text-xs"
        >
          <ul className="space-y-1">
            {templates.map((t) => {
              const isActive = t.id === active.id;
              return (
                <li key={t.id}>
                  <Link
                    href={`/settings/email-templates?active=${t.id}`}
                    className={`block rounded-md px-2 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <p className="font-semibold">{t.name}</p>
                    <p
                      className={`mt-0.5 text-[10px] ${
                        isActive ? 'text-background/80' : 'text-muted-foreground'
                      }`}
                    >
                      {t.description}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Subject
                </p>
                <p className="mt-1 text-base font-semibold">
                  {active.rendered.subject}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {active.id}
              </span>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <header className="border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              HTML preview — sandboxed iframe
            </header>
            <iframe
              srcDoc={active.rendered.html}
              sandbox=""
              title={`${active.name} preview`}
              className="h-[560px] w-full rounded-b-lg bg-white"
            />
          </div>

          <details className="rounded-lg border bg-card" open>
            <summary className="cursor-pointer px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-muted/50">
              Plain-text fallback
            </summary>
            <pre className="overflow-x-auto whitespace-pre-wrap border-t bg-muted/30 p-4 text-xs leading-5">
              {active.rendered.text}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

async function fetchSettings(): Promise<TenantSettings | null> {
  try {
    const res = await adminFetch('/v1/admin/settings');
    if (!res.ok) return null;
    const body = (await res.json()) as { data: TenantSettings };
    return body.data;
  } catch {
    return null;
  }
}

function toBrandContext(settings: TenantSettings | null): BrandContext {
  if (!settings) {
    return { name: 'ClaudeShop' };
  }
  return {
    name: settings.brand.name,
    ...(settings.storefront?.publicUrl
      ? { publicUrl: settings.storefront.publicUrl }
      : {}),
    ...(settings.storefront?.supportEmail
      ? { supportEmail: settings.storefront.supportEmail }
      : {}),
  };
}

function buildSampleOrder(currency: string): Order {
  const now = new Date('2026-04-19T14:32:00Z').toISOString();
  return {
    id: 'ord-preview-00042',
    tenantId: 'demo',
    number: 'CS-00042',
    customerId: null,
    anonymousEmail: 'sam@example.com',
    status: 'PAID',
    currency,
    totals: {
      subtotal: '82.00',
      tax: '16.40',
      discount: '5.00',
      shipping: '6.90',
      total: '100.30',
    },
    lines: [
      {
        id: 'line-1',
        orderId: 'ord-preview-00042',
        variantId: 'var-1',
        productName: 'Classic cotton tee',
        sku: 'HCS-TEE-S-BLK',
        qty: 2,
        unitPrice: '29.00',
        subtotal: '58.00',
        tax: '11.60',
        discount: '0.00',
        total: '69.60',
      },
      {
        id: 'line-2',
        orderId: 'ord-preview-00042',
        variantId: 'var-2',
        productName: 'Organic canvas tote',
        sku: 'HCS-TOTE-NAT',
        qty: 1,
        unitPrice: '24.00',
        subtotal: '24.00',
        tax: '4.80',
        discount: '5.00',
        total: '23.80',
      },
    ],
    placedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function buildSampleLowStock(): InventoryProjection[] {
  return [
    {
      variantId: 'var-1',
      productId: 'prod-1',
      productSlug: 'classic-cotton-tee',
      productName: { en: 'Classic cotton tee' },
      sku: 'HCS-TEE-S-BLK',
      locationId: 'loc-default',
      onHand: 0,
      reserved: 0,
      safetyStock: 10,
      available: -10,
      updatedAt: new Date().toISOString(),
    },
    {
      variantId: 'var-2',
      productId: 'prod-2',
      productSlug: 'organic-canvas-tote',
      productName: { en: 'Organic canvas tote' },
      sku: 'HCS-TOTE-NAT',
      locationId: 'loc-default',
      onHand: 4,
      reserved: 1,
      safetyStock: 15,
      available: -12,
      updatedAt: new Date().toISOString(),
    },
    {
      variantId: 'var-3',
      productId: 'prod-3',
      productSlug: 'alpine-wool-beanie',
      productName: { en: 'Alpine wool beanie' },
      sku: 'HCS-BEANIE-GRY',
      locationId: 'loc-default',
      onHand: 7,
      reserved: 0,
      safetyStock: 12,
      available: -5,
      updatedAt: new Date().toISOString(),
    },
  ];
}
