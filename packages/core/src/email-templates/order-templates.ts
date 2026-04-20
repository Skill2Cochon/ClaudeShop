import type { Order } from '@claudeshop/contracts/order';
import {
  escape,
  formatMoney,
  wrapHtml,
  type BrandContext,
  type RenderedEmail,
} from './render.js';

export interface OrderTemplateContext {
  brand: BrandContext;
  /** BCP-47 locale for money formatting. Defaults to 'en'. */
  locale?: string;
  /** Optional public URL for 'Track this order' / 'Your receipt' links. */
  orderUrl?: string;
}

function renderLines(order: Order, locale: string): string {
  return order.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:6px 0;color:#111">
            ${escape(line.productName)}
            <span style="color:#666"> · ${escape(line.sku)} · ×${line.qty}</span>
          </td>
          <td style="padding:6px 0;text-align:right;color:#111">${formatMoney(
            line.total,
            order.currency,
            locale,
          )}</td>
        </tr>`,
    )
    .join('');
}

function renderTextLines(order: Order, locale: string): string {
  return order.lines
    .map(
      (line) =>
        `  ${line.productName} · ${line.sku} · ×${line.qty}   ${formatMoney(
          line.total,
          order.currency,
          locale,
        )}`,
    )
    .join('\n');
}

function totalsBlock(order: Order, locale: string): string {
  const rows: Array<[string, string]> = [];
  rows.push(['Subtotal', formatMoney(order.totals.subtotal, order.currency, locale)]);
  if (order.totals.discount && Number.parseFloat(order.totals.discount) !== 0) {
    rows.push(['Discount', `- ${formatMoney(order.totals.discount, order.currency, locale)}`]);
  }
  if (order.totals.shipping && Number.parseFloat(order.totals.shipping) !== 0) {
    rows.push(['Shipping', formatMoney(order.totals.shipping, order.currency, locale)]);
  }
  if (order.totals.tax && Number.parseFloat(order.totals.tax) !== 0) {
    rows.push(['Tax', formatMoney(order.totals.tax, order.currency, locale)]);
  }
  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:4px 0;color:#666">${escape(label)}</td>
          <td style="padding:4px 0;text-align:right;color:#666">${escape(value)}</td>
        </tr>`,
    )
    .join('');
}

function button(label: string, href: string | undefined): string {
  if (!href) return '';
  return `
    <p style="margin:24px 0">
      <a href="${escape(href)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">
        ${escape(label)}
      </a>
    </p>`;
}

export function renderOrderPlaced(
  order: Order,
  ctx: OrderTemplateContext,
): RenderedEmail {
  const locale = ctx.locale ?? 'en';
  const subject = `Order #${order.number} confirmed — ${ctx.brand.name}`;
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:#111">Thanks for your order</h1>
    <p style="margin:0 0 20px;color:#555">Order <strong>#${escape(order.number)}</strong> is confirmed. Here's what you bought:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px">
      ${renderLines(order, locale)}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #eee;padding-top:12px">
      ${totalsBlock(order, locale)}
      <tr>
        <td style="padding:8px 0;border-top:1px solid #eee;color:#111;font-weight:600">Total</td>
        <td style="padding:8px 0;border-top:1px solid #eee;text-align:right;color:#111;font-weight:600">
          ${formatMoney(order.totals.total, order.currency, locale)}
        </td>
      </tr>
    </table>
    ${button('View your order', ctx.orderUrl)}
  `;
  const html = wrapHtml(ctx.brand, inner);
  const text = [
    `Thanks for your order.`,
    ``,
    `Order #${order.number} is confirmed.`,
    ``,
    renderTextLines(order, locale),
    ``,
    `Subtotal   ${formatMoney(order.totals.subtotal, order.currency, locale)}`,
    order.totals.tax && Number.parseFloat(order.totals.tax) !== 0
      ? `Tax        ${formatMoney(order.totals.tax, order.currency, locale)}`
      : null,
    order.totals.shipping && Number.parseFloat(order.totals.shipping) !== 0
      ? `Shipping   ${formatMoney(order.totals.shipping, order.currency, locale)}`
      : null,
    `Total      ${formatMoney(order.totals.total, order.currency, locale)}`,
    ``,
    ctx.orderUrl ? `View your order: ${ctx.orderUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, html, text };
}

export function renderOrderShipped(
  order: Order,
  ctx: OrderTemplateContext,
): RenderedEmail {
  const locale = ctx.locale ?? 'en';
  const subject = `Your order #${order.number} has shipped`;
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:#111">Your order is on the way</h1>
    <p style="margin:0 0 20px;color:#555">Order <strong>#${escape(order.number)}</strong> just shipped. It'll arrive soon.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px">
      ${renderLines(order, locale)}
    </table>
    ${button('Track your order', ctx.orderUrl)}
  `;
  const html = wrapHtml(ctx.brand, inner);
  const text = [
    `Your order is on the way.`,
    ``,
    `Order #${order.number} just shipped.`,
    ``,
    renderTextLines(order, locale),
    ``,
    ctx.orderUrl ? `Track: ${ctx.orderUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, html, text };
}

export function renderOrderCancelled(
  order: Order,
  ctx: OrderTemplateContext,
): RenderedEmail {
  const locale = ctx.locale ?? 'en';
  const subject = `Order #${order.number} cancelled`;
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:#111">Your order was cancelled</h1>
    <p style="margin:0 0 20px;color:#555">We've cancelled order <strong>#${escape(order.number)}</strong>. If a payment was captured, the refund will follow shortly.</p>
    <p style="margin:0 0 20px;color:#666">Order total: <strong>${formatMoney(order.totals.total, order.currency, locale)}</strong></p>
    ${button('See your orders', ctx.orderUrl)}
  `;
  const html = wrapHtml(ctx.brand, inner);
  const text = [
    `Your order was cancelled.`,
    ``,
    `Order #${order.number} has been cancelled. If a payment was captured, the refund will follow shortly.`,
    ``,
    `Order total: ${formatMoney(order.totals.total, order.currency, locale)}`,
    ``,
    ctx.orderUrl ? `See your orders: ${ctx.orderUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, html, text };
}

export interface RefundTemplateContext extends OrderTemplateContext {
  refundAmount: string;
  isFullRefund: boolean;
  reason?: string | null;
}

export function renderOrderRefunded(
  order: Order,
  ctx: RefundTemplateContext,
): RenderedEmail {
  const locale = ctx.locale ?? 'en';
  const subject = ctx.isFullRefund
    ? `Refund issued on order #${order.number}`
    : `Partial refund issued on order #${order.number}`;
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:#111">${ctx.isFullRefund ? 'Refund issued' : 'Partial refund issued'}</h1>
    <p style="margin:0 0 20px;color:#555">We've refunded <strong>${formatMoney(
      ctx.refundAmount,
      order.currency,
      locale,
    )}</strong> on order <strong>#${escape(order.number)}</strong>. Depending on your bank, it may take a few business days to land.</p>
    ${
      ctx.reason
        ? `<p style="margin:0 0 20px;color:#666"><em>Reason:</em> ${escape(ctx.reason)}</p>`
        : ''
    }
    ${button('See your order', ctx.orderUrl)}
  `;
  const html = wrapHtml(ctx.brand, inner);
  const text = [
    ctx.isFullRefund ? `Refund issued.` : `Partial refund issued.`,
    ``,
    `We've refunded ${formatMoney(ctx.refundAmount, order.currency, locale)} on order #${order.number}.`,
    ctx.reason ? `Reason: ${ctx.reason}` : null,
    ``,
    ctx.orderUrl ? `See your order: ${ctx.orderUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, html, text };
}
