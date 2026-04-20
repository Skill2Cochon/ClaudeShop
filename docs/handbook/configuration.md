---
title: Configuration
aliases:
  - Env Vars
  - Settings
tags:
  - type/handbook
  - handbook/configuration
  - project/claudeshop
status: stable
updated: 2026-04-20
---

# Configuration

> [!abstract] Every knob you can turn.
> ClaudeShop reads configuration from three places : (1) `.env` for infrastructure + secrets, (2) the admin **Settings** surfaces for merchant-facing config, (3) per-tenant JSON (`Tenant.settings`) for currency/locale/plan. This note covers all three.

**See also** :: [[getting-started|Getting Started]] · [[admin-tour#Settings|Admin Tour § Settings]] · [[deployment|Deployment]] · [[../../CLAUDE|CLAUDE.md]]

## 1 · `.env` Reference

Copy `.env.example` → `.env` locally. Production uses `.env.production.example` managed via Coolify secrets (see [[deployment#Secrets|Deployment § Secrets]]).

### 1.1 Node runtime

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` in Coolify. Switches Fastify logger, Next build mode, error verbosity. |
| `LOG_LEVEL` | `debug` | `trace` `debug` `info` `warn` `error` — pino levels used by `@claudeshop/telemetry`. |

### 1.2 URLs (public + internal)

| Variable | Example | Used by |
|---|---|---|
| `API_PUBLIC_URL` | `https://api.shop.example.com` | OpenAPI base, webhook outbound URLs, CORS |
| `STOREFRONT_URL` | `https://shop.example.com` | Emails, redirects, order-success links |
| `ADMIN_URL` | `https://admin.shop.example.com` | Auth.js trusted host, copilot redirects |
| `NEXT_PUBLIC_API_URL` | `https://api.shop.example.com` | Browser-side SDK baseURL |

> [!warning] `NEXT_PUBLIC_*` is bundled into the client — never put secrets here.

### 1.3 PostgreSQL

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Primary connection — points at PgBouncer in prod (`port=6432`) |
| `DIRECT_URL` | Direct Postgres (no pooler) — Prisma uses this for migrations |

> [!tip] Pooler vs direct
> In production set `DATABASE_URL=postgresql://…@pgbouncer:6432/claudeshop?pgbouncer=true` and `DIRECT_URL=postgresql://…@postgres:5432/claudeshop` so `prisma migrate deploy` bypasses the pool.

### 1.4 Redis (sessions + BullMQ + cache)

| Variable | Purpose |
|---|---|
| `REDIS_URL` | `redis://:pw@redis:6379` — sessions, queue, query cache |
| `REDIS_PASSWORD` | Empty in dev, **set in prod** |

### 1.5 Meilisearch (faceted search)

| Variable | Purpose |
|---|---|
| `MEILISEARCH_URL` | `http://meilisearch:7700` |
| `MEILISEARCH_MASTER_KEY` | Server-side only — rotate on deploy |

### 1.6 MinIO / S3 (object storage)

| Variable | Purpose |
|---|---|
| `MINIO_ENDPOINT` | S3-compatible endpoint |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Write credentials |
| `MINIO_BUCKET` | Default media bucket (auto-created on first run) |

Swap for real AWS S3 in prod by pointing `MINIO_ENDPOINT` at `https://s3.amazonaws.com` and providing IAM creds.

### 1.7 Email (SMTP)

| Variable | Purpose |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` | Mailhog `localhost:1025` in dev, your relay in prod |
| `SMTP_USER` / `SMTP_PASS` | Leave empty if relay is IP-whitelisted |
| `SMTP_FROM` | `No Reply <no-reply@yourstore.com>` |

### 1.8 Auth.js v5

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | **Required** — `openssl rand -base64 32`. Rotating this logs out all admins. |
| `AUTH_URL` | Admin public URL (OAuth callback base) |
| `AUTH_TRUST_HOST` | `true` behind a proxy/CDN |

### 1.9 Stripe (payments)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` dev, `sk_live_…` prod — **server-only** |
| `STRIPE_PUBLISHABLE_KEY` | `pk_…` — sent to storefront (safe to expose) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` — validates incoming Stripe webhooks |

Mollie adapter uses `MOLLIE_API_KEY` (add when you enable the module).

### 1.10 Claude / AI

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required for copilot + semantic search embedding + copy generation |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-4-6` — copilot uses Sonnet, deep-reasoning tools Opus |

### 1.11 Observability

| Variable | Purpose |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector URL |
| `OTEL_SERVICE_NAME` | `claudeshop-api` / `claudeshop-admin` / `claudeshop-storefront` |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.namespace=claudeshop,deployment.environment=prod` |

## 2 · Merchant Settings (in the Admin)

> [!info] Where merchants live
> Everything in this section is a click — no code, no `.env` edit. Go to **Settings** in the admin sidebar.

| Sub-section | What it holds | Storage |
|---|---|---|
| **Site** | store name, logo, default locale/currency, contact email, footer copy | `Tenant.settings` JSON |
| **Email Templates** | order confirmation, shipped, welcome, password reset — Markdown + MJML preview | `EmailTemplate` table |
| **API Keys** | merchant-generated keys for headless storefronts + 3rd-party integrations | `ApiKey` table (hashed) |
| **Payments** | activate Stripe / Mollie / manual — per-tenant toggle + keys stored encrypted | `PaymentProviderConfig` |
| **Shipping Rates** | carrier + weight brackets + flat-rate fallback | `ShippingRate` table |
| **Tax Rates** | VAT / sales tax per region + product tax class | `TaxRate` table |
| **Webhooks** | outbound subscriptions (order.created, customer.updated, …) + delivery log + manual redeliver | `WebhookSubscription` + `WebhookDelivery` |
| **Modules** | install / enable / disable plugins from the registry | `Module` table + module-kit lifecycle |
| **Security** | change password, rotate session, view active logins | `AuthUser` |

Full walkthrough :: [[admin-tour#Settings|Admin Tour § Settings]].

## 3 · Multi-Tenant Setup

> [!tldr] One install, many stores
> ClaudeShop is multi-tenant by design. Every table has `tenantId` + RLS policies. A tenant maps 1-to-1 with a store.

### 3.1 Create a new tenant (CLI)

```bash
# Dry-run — just prints the SQL
pnpm --filter @claudeshop/db create-tenant -- \
  --slug=acme \
  --name="ACME Corp" \
  --plan=PRO \
  --currency=USD \
  --locales=en,fr \
  --admin-email=owner@acme.com \
  --admin-password=REPLACE_WITH_SECURE
```

Under the hood :
1. Inserts a `Tenant` row with the requested settings JSON
2. Runs `withTenant(prisma, tenantId, …)` scope so RLS applies
3. Creates the first `AuthUser` with role `ADMIN` and a bcrypt hash
4. Seeds 2 default email templates (welcome, order-confirmation) + 1 default shipping rate

### 3.2 Routing a request to a tenant

| Surface | Mechanism |
|---|---|
| **Admin** | `Tenant.slug` resolved from `x-tenant-slug` header (set by Auth.js after login) or subdomain |
| **Storefront** | Host-based (`acme.shop.example.com` → tenant `acme`) — see `apps/storefront/src/lib/tenant.ts` |
| **API** | Client sends `x-tenant-id: <uuid>` with every request — enforced by `resolveTenantId` (`apps/api/src/middleware/tenant.ts`) |

### 3.3 RLS (Row-Level Security)

Every tenant-scoped table has a policy :

```sql
CREATE POLICY tenant_isolation_<table>
  ON "<Table>"
  USING ("tenantId" = current_setting('app.current_tenant_id')::uuid);
```

The Prisma client sets `app.current_tenant_id` per-transaction via `withTenant`. **Breaking this wrapper leaks data across tenants** — covered by an integration test in `apps/api/test/rls.spec.ts`.

## 4 · Per-Tenant JSON (`Tenant.settings`)

```ts
// packages/contracts/src/tenant/index.ts
export const TenantSettingsSchema = z.object({
  currency: z.string().length(3),        // ISO 4217
  defaultLocale: z.string().min(2),      // BCP 47
  locales: z.array(z.string()).min(1),
  timezone: z.string().optional(),       // IANA
  plan: z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  features: z.record(z.boolean()).optional(),  // feature flags
});
```

Merchants edit this via **Settings → Site**. Developers read it via `tenantRepo.getSettings(tenantId)`.

## 5 · Secrets Rotation

> [!important] Quarterly rotation schedule
> - `AUTH_SECRET` — logs out all admins; rotate with a 48h overlap (Auth.js supports key array)
> - `STRIPE_WEBHOOK_SECRET` — rotate in Stripe dashboard then update Coolify secret
> - `ANTHROPIC_API_KEY` — rotate in Anthropic console; zero downtime
> - `MEILISEARCH_MASTER_KEY` — requires restart of Meilisearch + api
> - `MINIO_SECRET_KEY` — requires restart of api + storefront

All production secrets live in **your chosen secret manager** (Coolify built-in, Doppler, HashiCorp Vault, 1Password, AWS Secrets Manager — whichever you adopt). Never in `.env` files checked into git. Production deploys refuse to boot if any required secret is missing — see `apps/api/src/config/require-env.ts`.

## 6 · Feature Flags (per-tenant)

Enable experimental features without a redeploy :

```ts
// Server-side check
if (tenant.settings.features?.['ai.copilot.writes'] !== true) {
  throw new PermissionError('ai.copilot.writes is disabled for this tenant');
}
```

Current flags :
- `ai.copilot.writes` — allow Claude mutations (default **off**, requires explicit opt-in per AI safety rule)
- `b2b.requisitions` — enable multi-step approval workflow (Phase 4)
- `inventory.multi-warehouse` — per-location stock tracking
- `ui.dark-mode` — admin dark theme

Flags are toggled from **Settings → Modules → Feature Flags**.

## 7 · What Can Claude Change on Its Own?

> [!warning] Claude is a companion, not an admin
> Per the [[../../CLAUDE#Vision Principles|Vision Principles]], every mutation Claude proposes goes through a diff preview + click-to-confirm. Read-only queries run immediately. Configuration (`.env`, secrets, infra) is **never** Claude-editable from the copilot — only from your terminal or Coolify.

| Surface | Claude read | Claude write | Requires confirm |
|---|---|---|---|
| Products | ✅ | ✅ | ✅ |
| Orders (status updates) | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ (notes only) | ✅ |
| `Tenant.settings` | ✅ | ❌ | — |
| `.env` / secrets | ❌ | ❌ | — |
| Code / migrations | ❌ | ❌ | — |

## Related

- [[getting-started|Getting Started]]
- [[admin-tour|Admin Tour]]
- [[deployment|Deployment]]
- [[../../CLAUDE|CLAUDE.md]]
- [[../adrs/ADR-002-multi-tenant-strategy|ADR-002 Multi-Tenant Strategy]]
