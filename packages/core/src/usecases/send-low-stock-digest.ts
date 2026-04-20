import { z } from 'zod';
import type { TenantSettings } from '@claudeshop/contracts/tenant-settings';
import { ValidationError } from '@claudeshop/errors';
import type { EmailProvider } from '../ports/email-provider';
import type {
  InventoryProjection,
  InventoryRepository,
} from '../ports/inventory-repository';
import { renderLowStockDigest } from '../email-templates/inventory-templates';

export interface SendLowStockDigestInput {
  /** Recipient address — falls back to settings.storefront.supportEmail. */
  to?: string;
  /** Optional from — defaults to support email or a tenant placeholder. */
  from?: string;
  /** Hard cap on rows fetched; the template shows the top 20 anyway. */
  limit?: number;
}

export interface SendLowStockDigestDeps {
  tenantId: string;
  email: EmailProvider;
  inventoryRepo: InventoryRepository;
  settings: TenantSettings;
}

export interface SendLowStockDigestResult {
  sent: boolean;
  reason?: string;
  rowCount: number;
  to?: string;
}

const InputSchema = z.object({
  to: z.string().email().optional(),
  from: z.string().email().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

/**
 * Phase 52 — compute the low-stock slice and fire the digest email.
 *
 * Returns a `sent=false, reason='no-recipient'` when neither the
 * caller nor the settings expose a support email, so the caller can
 * log a soft "skipped" line and move on — digests should never
 * throw from missing configuration.
 *
 * When there are zero low-stock rows we still return early with
 * `sent=false, reason='nothing-to-digest'` instead of shipping an
 * empty email. Merchants who want a "heartbeat" confirmation should
 * point a weekly health-check at the endpoint, not an empty-state
 * digest.
 */
export async function sendLowStockDigest(
  input: SendLowStockDigestInput,
  deps: SendLowStockDigestDeps,
): Promise<SendLowStockDigestResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid low-stock digest input', {
      details: parsed.error.issues,
    });
  }

  const to = parsed.data.to ?? deps.settings.storefront?.supportEmail ?? null;
  if (!to) {
    return {
      sent: false,
      reason: 'no-recipient',
      rowCount: 0,
    };
  }

  // Fetch both low-stock + out-of-stock slices and merge. The repo
  // lets us filter by one predicate at a time, so we issue two
  // queries and de-dupe on variantId — it's cheap and the alternative
  // is widening the port for a single caller.
  const limit = parsed.data.limit ?? 100;
  const [low, out] = await Promise.all([
    deps.inventoryRepo.listProjections(deps.tenantId, {
      page: 1,
      limit,
      lowOnly: true,
    }),
    deps.inventoryRepo.listProjections(deps.tenantId, {
      page: 1,
      limit,
      outOfStockOnly: true,
    }),
  ]);

  const seen = new Set<string>();
  const rows: InventoryProjection[] = [];
  for (const row of [...out.items, ...low.items]) {
    if (seen.has(row.variantId)) continue;
    seen.add(row.variantId);
    rows.push(row);
  }
  // Sort: out-of-stock first (onHand 0), then most-urgent below-
  // safety (available ascending) so the email's top rows are the
  // ones the merchant needs to act on first.
  rows.sort((a, b) => {
    if (a.onHand === 0 && b.onHand !== 0) return -1;
    if (b.onHand === 0 && a.onHand !== 0) return 1;
    return a.available - b.available;
  });

  if (rows.length === 0) {
    return { sent: false, reason: 'nothing-to-digest', rowCount: 0, to };
  }

  const brand = {
    name: deps.settings.brand.name,
    ...(deps.settings.storefront?.publicUrl
      ? { publicUrl: deps.settings.storefront.publicUrl }
      : {}),
    ...(deps.settings.storefront?.supportEmail
      ? { supportEmail: deps.settings.storefront.supportEmail }
      : {}),
  };
  const inventoryUrl = deps.settings.storefront?.publicUrl
    ? `${deps.settings.storefront.publicUrl.replace(/\/$/, '')}/admin/inventory`
    : undefined;

  const rendered = renderLowStockDigest(rows, {
    brand,
    ...(inventoryUrl ? { inventoryUrl } : {}),
  });

  const from =
    parsed.data.from ??
    deps.settings.storefront?.supportEmail ??
    `no-reply@${deps.settings.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'claudeshop'}.local`;

  await deps.email.send({
    from,
    recipients: [{ email: to }],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: {
      tenant: deps.tenantId,
      kind: 'inventory.low_stock_digest',
      rowCount: String(rows.length),
    },
  });

  return { sent: true, rowCount: rows.length, to };
}
