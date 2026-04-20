import type { InventoryProjection } from '../ports/inventory-repository';
import {
  escape,
  wrapHtml,
  type BrandContext,
  type RenderedEmail,
} from './render';

export interface LowStockTemplateContext {
  brand: BrandContext;
  inventoryUrl?: string;
}

export function renderLowStockDigest(
  rows: InventoryProjection[],
  ctx: LowStockTemplateContext,
): RenderedEmail {
  const visible = rows.slice(0, 20);
  const outOfStock = rows.filter((r) => r.onHand === 0).length;
  const lowOnly = rows.length - outOfStock;
  const subject = `${rows.length} variant${rows.length === 1 ? '' : 's'} below safety stock`;

  const listHtml = visible
    .map(
      (row) => `
        <tr>
          <td style="padding:6px 0;color:#111;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px">
            ${escape(row.sku)}
            <span style="color:#666"> · on-hand ${row.onHand} · reserved ${row.reserved} · safety ${row.safetyStock}</span>
          </td>
          <td style="padding:6px 0;text-align:right;color:${row.onHand === 0 ? '#b91c1c' : '#b45309'};font-weight:600">
            ${row.onHand === 0 ? 'OUT' : 'LOW'}
          </td>
        </tr>`,
    )
    .join('');

  const overflow = rows.length > visible.length
    ? `<p style="margin:12px 0 0;color:#666;font-size:12px">…and ${rows.length - visible.length} more. Open the inventory dashboard to see all.</p>`
    : '';

  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:#111">Low-stock digest</h1>
    <p style="margin:0 0 20px;color:#555">
      ${outOfStock} out of stock · ${lowOnly} below safety.
      The variants below need a reorder or a safety-stock revision.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px">
      ${listHtml}
    </table>
    ${overflow}
    ${
      ctx.inventoryUrl
        ? `<p style="margin:24px 0"><a href="${escape(ctx.inventoryUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open inventory dashboard</a></p>`
        : ''
    }
  `;
  const html = wrapHtml(ctx.brand, inner);
  const text = [
    `Low-stock digest`,
    ``,
    `${outOfStock} out of stock, ${lowOnly} below safety.`,
    ``,
    ...visible.map(
      (row) =>
        `  ${row.sku} — on-hand ${row.onHand} · reserved ${row.reserved} · safety ${row.safetyStock} — ${row.onHand === 0 ? 'OUT' : 'LOW'}`,
    ),
    rows.length > visible.length
      ? `  …and ${rows.length - visible.length} more`
      : null,
    ``,
    ctx.inventoryUrl ? `Open inventory dashboard: ${ctx.inventoryUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, html, text };
}
