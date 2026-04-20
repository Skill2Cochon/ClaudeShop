import { z } from 'zod';
import type { Order } from '@claudeshop/contracts/order';
import type { TenantSettings } from '@claudeshop/contracts/tenant-settings';
import { ValidationError } from '@claudeshop/errors';
import type { EmailProvider } from '../ports/email-provider';
import {
  renderOrderCancelled,
  renderOrderPlaced,
  renderOrderRefunded,
  renderOrderShipped,
  type BrandContext,
} from '../email-templates/index';

export const OrderTransactionalKindSchema = z.enum([
  'placed',
  'shipped',
  'cancelled',
  'refunded',
]);
export type OrderTransactionalKind = z.infer<typeof OrderTransactionalKindSchema>;

export interface SendOrderTransactionalInput {
  kind: OrderTransactionalKind;
  order: Order;
  /** The merchant email used as From. Defaults to a placeholder when absent. */
  from?: string;
  /** Recipient address — defaults to order.anonymousEmail when omitted. */
  to?: string;
  /** Optional per-kind extras. */
  refundAmount?: string;
  isFullRefund?: boolean;
  refundReason?: string | null;
  /** Public URL the email should link back to. */
  orderUrl?: string;
}

export interface SendOrderTransactionalDeps {
  tenantId: string;
  email: EmailProvider;
  /** The tenant settings used for brand + public URL. */
  settings: TenantSettings;
}

/**
 * Pick + render + send the right transactional email for an order
 * lifecycle event. Handles the guest-checkout case where the only
 * recipient is `order.anonymousEmail` (customer entity may be absent).
 *
 * Returns a skipped-true result when there's no resolvable recipient —
 * the caller can log it as a non-failure and move on.
 */
export async function sendOrderTransactional(
  input: SendOrderTransactionalInput,
  deps: SendOrderTransactionalDeps,
): Promise<{ sent: boolean; reason?: string }> {
  const kindParse = OrderTransactionalKindSchema.safeParse(input.kind);
  if (!kindParse.success) {
    throw new ValidationError('Invalid transactional kind', {
      details: kindParse.error.issues,
    });
  }

  const to = input.to ?? input.order.anonymousEmail ?? null;
  if (!to) {
    return { sent: false, reason: 'no-recipient' };
  }

  const brand: BrandContext = {
    name: deps.settings.brand.name,
    ...(deps.settings.storefront?.publicUrl
      ? { publicUrl: deps.settings.storefront.publicUrl }
      : {}),
    ...(deps.settings.storefront?.supportEmail
      ? { supportEmail: deps.settings.storefront.supportEmail }
      : {}),
  };

  const orderUrl =
    input.orderUrl ??
    (deps.settings.storefront?.publicUrl
      ? `${deps.settings.storefront.publicUrl.replace(/\/$/, '')}/${deps.settings.defaultLocale}/order/${input.order.id}/confirmed`
      : undefined);

  const ctx = {
    brand,
    locale: deps.settings.defaultLocale,
    ...(orderUrl ? { orderUrl } : {}),
  };

  const rendered = (() => {
    switch (input.kind) {
      case 'placed':
        return renderOrderPlaced(input.order, ctx);
      case 'shipped':
        return renderOrderShipped(input.order, ctx);
      case 'cancelled':
        return renderOrderCancelled(input.order, ctx);
      case 'refunded':
        if (!input.refundAmount) {
          throw new ValidationError('refundAmount required for refund template');
        }
        return renderOrderRefunded(input.order, {
          ...ctx,
          refundAmount: input.refundAmount,
          isFullRefund: input.isFullRefund ?? false,
          reason: input.refundReason ?? null,
        });
    }
  })();

  const from =
    input.from ??
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
      kind: `order.${input.kind}`,
      orderId: input.order.id,
    },
  });

  return { sent: true };
}
