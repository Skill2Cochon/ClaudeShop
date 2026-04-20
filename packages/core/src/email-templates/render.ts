/**
 * Zero-dep email rendering primitives. Every template returns a pure
 * `{ subject, html, text }` triple that the caller passes into
 * EmailProvider.send alongside a From + recipient list.
 *
 * We intentionally avoid a templating library (MJML, Handlebars, React
 * Email) at this layer — the core package has to stay framework-free.
 * Phase 32.1 can swap in a fancier renderer by replacing these
 * functions; the use-case surface stays stable.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** HTML-safe escape for user-supplied values we interpolate into the body. */
export function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Money format helper — falls back to a plain decimal when Intl fails. */
export function formatMoney(
  amount: string | number,
  currency: string,
  locale = 'en',
): string {
  const num = typeof amount === 'number' ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(num)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

export interface BrandContext {
  name: string;
  /** Optional — absolute URL used in header + email footer. */
  publicUrl?: string;
  supportEmail?: string;
}

/** Shared email chrome: subtle header with brand name + minimal footer. */
export function wrapHtml(
  brand: BrandContext,
  inner: string,
): string {
  const publicUrlLine = brand.publicUrl
    ? `<a href="${escape(brand.publicUrl)}" style="color:#0ea5e9;text-decoration:none">${escape(
        brand.publicUrl,
      )}</a>`
    : '';
  const supportLine = brand.supportEmail
    ? `Questions? Reach us at <a href="mailto:${escape(
        brand.supportEmail,
      )}" style="color:#0ea5e9;text-decoration:none">${escape(
        brand.supportEmail,
      )}</a>.`
    : '';
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f5f5f5;color:#111">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
            <tr>
              <td style="padding:20px 28px;border-bottom:1px solid #eee">
                <strong style="font-size:14px;letter-spacing:0.04em;text-transform:uppercase;color:#666">${escape(
                  brand.name,
                )}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #eee;font-size:12px;color:#666">
                ${supportLine}
                ${supportLine && publicUrlLine ? '<br>' : ''}
                ${publicUrlLine}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
