import { z } from 'zod';
import { CuidSchema, IsoDateTimeSchema } from '../common/primitives';

// --- SSRF guard ---------------------------------------------------------

/**
 * Webhook URLs must be HTTPS-only and must not point at private, loopback,
 * link-local, or cloud-metadata address ranges. Without this check a merchant
 * could register a webhook that forces the API to fetch internal services
 * (Redis, Postgres, AWS metadata at 169.254.169.254, etc.) and have the
 * response echoed back to them — a classic SSRF pivot.
 *
 * We reject:
 *   - any scheme other than https (http is only allowed in dev — see NODE_ENV check at route layer)
 *   - hostnames that are literal IPs in RFC1918, loopback, link-local, or IPv6 equivalents
 *   - the well-known cloud-metadata hosts (AWS, GCP, Azure, DO, Alibaba, Hetzner)
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  // Cloud metadata endpoints (all known providers)
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata.goog',
  '100.100.100.200',
]);

const BLOCKED_IPV4_PREFIXES = [
  '0.',          // this network
  '10.',         // RFC1918
  '127.',        // loopback
  '169.254.',    // link-local + cloud metadata
  '192.0.0.',    // IETF
  '192.168.',    // RFC1918
  '224.',        // multicast
  '240.',        // reserved
];

function isBlockedIPv4(host: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  if (BLOCKED_IPV4_PREFIXES.some((p) => host.startsWith(p))) return true;
  // 172.16.0.0 – 172.31.255.255 is also RFC1918
  const parts = host.split('.').map(Number);
  const a = parts[0];
  const b = parts[1];
  if (a === 172 && typeof b === 'number' && b >= 16 && b <= 31) return true;
  return false;
}

function isBlockedIPv6(host: string): boolean {
  if (!host.includes(':')) return false;
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === '::1' ||                    // loopback
    h === '::' ||                     // unspecified
    h.startsWith('fc') || h.startsWith('fd') ||  // unique-local
    h.startsWith('fe80:') ||          // link-local
    h.startsWith('ff')                // multicast
  );
}

export const WebhookUrlSchema = z
  .string()
  .url()
  .max(2048)
  .superRefine((val, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(val);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid URL' });
      return;
    }
    // HTTPS only — HTTP allowed only in tests via a separate schema.
    if (parsed.protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        message: 'Webhook URL must use https://',
      });
      return;
    }
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) {
      ctx.addIssue({ code: 'custom', message: 'Host is not allowed (SSRF guard)' });
      return;
    }
    if (isBlockedIPv4(host) || isBlockedIPv6(host)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Private/loopback/link-local addresses are not allowed',
      });
      return;
    }
    // Block `.local` mDNS hostnames which resolve to LAN services.
    if (host.endsWith('.local') || host.endsWith('.internal')) {
      ctx.addIssue({ code: 'custom', message: 'Local-only hostname not allowed' });
      return;
    }
  });

// --- Subscription -------------------------------------------------------

export const WebhookSubscriptionSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  url: z.string().url(),
  /** HMAC-SHA256 secret used to sign request bodies. */
  secret: z.string().min(16),
  /** Topic names the merchant is subscribed to. */
  events: z.array(z.string().min(1)).min(1).max(50),
  isActive: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

export const CreateWebhookSubscriptionInputSchema = z.object({
  url: WebhookUrlSchema,
  secret: z.string().min(16).max(256).optional(),
  events: z.array(z.string().min(1)).min(1).max(50),
  isActive: z.boolean().optional(),
});
export type CreateWebhookSubscriptionInput = z.infer<
  typeof CreateWebhookSubscriptionInputSchema
>;

export const UpdateWebhookSubscriptionInputSchema =
  CreateWebhookSubscriptionInputSchema.partial();
export type UpdateWebhookSubscriptionInput = z.infer<
  typeof UpdateWebhookSubscriptionInputSchema
>;

// --- Delivery -----------------------------------------------------------

export const WebhookDeliveryStatusSchema = z.enum([
  'PENDING',
  'DELIVERED',
  'FAILED',
]);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

export const WebhookDeliverySchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  subscriptionId: CuidSchema,
  eventType: z.string(),
  eventId: z.string(),
  payload: z.unknown(),
  status: WebhookDeliveryStatusSchema,
  attemptCount: z.number().int().min(0),
  lastAttemptAt: IsoDateTimeSchema.nullable(),
  deliveredAt: IsoDateTimeSchema.nullable(),
  responseStatus: z.number().int().nullable(),
  responseBody: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;
