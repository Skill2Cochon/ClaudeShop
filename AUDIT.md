---
title: Pre-Launch Security Audit
aliases:
  - Audit
  - Pre-1.0 Audit
tags:
  - type/runbook
  - scope/security
status: active
updated: 2026-04-20
---

# Pre-Launch Security Audit — 2026-04-20

> [!warning] Read before any public-internet deploy.
> This report summarises the pre-1.0 security review. Items marked **CRITICAL** must be resolved before accepting public traffic. **HIGH** items should ship with the first patched release. **MEDIUM** items are hardening backlog. Two quick-wins have already landed in `main` (see [Already Fixed](#already-fixed)).

## TL;DR

| Severity | Open | Fixed in `main` |
|---|---|---|
| Critical | **1** (admin auth guard) | 0 |
| High | **2** | **2** (SSRF guard + tenantId UUID validation) |
| Medium | 4 | 0 |

Risk to local-dev / single-merchant demo: **low**. Risk to a public multi-tenant deploy: **high** until the admin auth guard lands.

---

## Already Fixed (landed before the repo went public)

### ✅ FIXED-H1 · `$executeRawUnsafe` tenant scoping was fragile
- **File** :: `packages/db/src/client.ts`
- **Before** :: `SET LOCAL app.tenant_id = '<escaped-tenantId>'` — escaping relied on `.replace(/'/g, "''")` which is fragile against non-ASCII or null bytes.
- **After** :: Input is regex-validated to Cuid (`c[a-z0-9]{24,}`) or UUID shape **before** interpolation. Any character outside `[A-Za-z0-9-]` throws.
- **Commit** :: see `packages/db/src/client.ts`.

### ✅ FIXED-H2 · SSRF via webhook subscription URL
- **File** :: `packages/contracts/src/webhook/index.ts`
- **Before** :: `CreateWebhookSubscriptionInputSchema.url = z.string().url().max(2048)` — accepted `http://169.254.169.254/` (AWS metadata), `http://redis:6379/`, etc.
- **After** :: New `WebhookUrlSchema` enforces HTTPS-only + blocks loopback / RFC1918 / link-local IPv4, all common IPv6 private ranges, `.local`/`.internal` hostnames, and known cloud-metadata endpoints. Applied to both `CreateWebhookSubscriptionInputSchema` and `UpdateWebhookSubscriptionInputSchema`.

---

## Open — CRITICAL

### 🔴 CRIT-1 · Missing auth guard on `/v1/admin/*`
- **Files** :: every `apps/api/src/routes/admin-*.ts`
- **Symptom** :: Routes rely on `x-tenant-id` / API key resolution but do **not** assert that the resolved caller has an `admin` role. Anyone holding a tenant ID (or a leaked read-only API key) can call mutating endpoints.
- **Impact** :: Full read/write on orders, customers, products, inventory, webhooks, settings — per tenant.
- **Fix plan** ::
  1. Add a Fastify preHandler plugin `apps/api/src/plugins/require-admin.ts` that reads the authenticated principal and asserts `role === 'ADMIN' || role === 'OWNER'`.
  2. Register it on every admin route group in `apps/api/src/app.ts` (ideally as `app.register(adminRoutes, { preHandler: [requireAdmin] })`).
  3. Add an integration test that confirms anonymous + non-admin API keys receive `403`.
- **ETA** :: 1 phase (small but touches ~20 route files).

---

## Open — HIGH

### 🟠 HIGH-1 · `.env.production` was missing from `.gitignore`
- **Status** :: ✅ fixed in `main` (commit in the install-kit push).
- **What to check** :: if you've previously cloned this repo, re-pull `main` to pick up the new ignore rules.

### 🟠 HIGH-2 · Rate limit is global, not endpoint-specific
- **File** :: `apps/api/src/app.ts` (registration of `@fastify/rate-limit`)
- **Symptom** :: `/v1/auth/login` shares the 100/min global bucket — credential-stuffing friendly.
- **Fix** :: Add per-route config : `{ config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: ipOrApiKey } } }` on auth endpoints. Also worth adding to `/v1/public/subscribe` and `/v1/public/orders/track`.
- **ETA** :: ~30 min.

---

## Open — MEDIUM

### 🟡 MED-1 · MinIO bucket is anonymous-download
- **File** :: `docker-compose.prod.yml` (`minio-init` service) + `docker-compose.yml`
- **Symptom** :: `mc anonymous set download local/${MINIO_BUCKET}` makes every uploaded asset world-readable. Correct for product images; wrong if you store invoices or private docs in the same bucket.
- **Fix** :: Split buckets (`claudeshop-media-public` vs `claudeshop-media-private`) or use signed URLs for non-image assets.

### 🟡 MED-2 · Docker images use floating tags
- **File** :: `docker-compose.prod.yml`
- **Symptom** :: `edoburu/pgbouncer:latest`, `minio/mc:latest` — supply-chain risk.
- **Fix** :: Pin to specific SHA digests. Dependabot (if added) can nudge these.

### 🟡 MED-3 · CORS is `origin: true` in dev, regex in prod
- **File** :: `apps/api/src/app.ts`
- **Symptom** :: Dev is open by design, but a misconfigured `NODE_ENV` ships open CORS to prod.
- **Fix** :: Add a startup assertion — if `NODE_ENV === 'production'` and `CORS_ORIGINS` env var is unset, refuse to start.

### 🟡 MED-4 · `$queryRawUnsafe` in analytics / search adapters
- **Files** :: `apps/api/src/adapters/prisma-analytics-repository.ts`, `prisma-search-repository.ts`
- **Symptom** :: All user-supplied values use `$1/$2` positional params (safe). One interpolated string (`vectorLiteral`) is built from server-generated `number[]` — also safe, but one refactor away from danger.
- **Fix** :: Add a unit test asserting `toVectorLiteral` rejects non-numeric input.

---

## PII / Leak Audit

### Git history
- `git log --all -- .env .env.local .env.production` :: **no hits**. No secret has ever been committed.

### Current tree
- **Clean** as of this audit — all references to private hostnames, personal emails, and internal infrastructure have been scrubbed from the public repo (`CLAUDE.md`, `README.md`, `DEPLOY.md`, handbook, ADRs, `.claude/plan/*`, `_meta/*`, `architecture.canvas`).
- Developer private context belongs in `.claude/CLAUDE.local.md` (gitignored). A template exists at `.claude/CLAUDE.local.md.example`.

---

## Recommended Order of Fixes

1. **CRIT-1** — admin auth guard (blocker for any public deploy)
2. **HIGH-2** — per-route rate limit on `/v1/auth/*`
3. **MED-2** — pin Docker image tags
4. **MED-1** — MinIO bucket split
5. **MED-3** — CORS startup assertion
6. **MED-4** — vector literal input test

---

## How to re-run the audit

```bash
# Spawn the security-reviewer agent (Claude Code)
claude agent run security-reviewer -- "Audit the repo against AUDIT.md; report newly introduced findings only."

# Or rerun the Zod validation tests
pnpm --filter @claudeshop/contracts test
```

## Related

- [[SECURITY|SECURITY.md]] — reporting + SLO
- [[CLAUDE|CLAUDE.md § Anti-Patterns]] — forbidden patterns in the code base
- [[.claude/install|Install Playbook § Appendix A]] — what the installer must surface in the hand-off
