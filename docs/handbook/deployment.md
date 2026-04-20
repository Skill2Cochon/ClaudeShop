---
title: Deployment
aliases:
  - Deploy
  - Production Setup
tags:
  - type/handbook
  - handbook/deployment
  - project/claudeshop
status: stable
updated: 2026-04-20
---

# Deployment

> [!abstract] From zero to a live store in one afternoon.
> ClaudeShop ships with a production Docker stack (`docker-compose.prod.yml`), Coolify-ready manifest (`.coolify/stack.yaml`), per-app multi-stage Dockerfiles, and a bootstrap script. Two paths : **Coolify (recommended)** or **generic Docker host**.

**See also** :: [[getting-started|Getting Started]] · [[configuration|Configuration]] · [[admin-tour|Admin Tour]] · [[../../CLAUDE|CLAUDE.md § Architecture]]

## 1 · Two Deployment Paths

### Path A — Coolify (recommended)
Aligns with the any self-hosted mesh — Coolify lives on your deploy host and already has the WireGuard mesh + Traefik + secret manager. One-command deploy from a Gitea push.

### Path B — Generic Docker host
Any VPS with Docker + Docker Compose 2.x. You manage TLS (Caddy / Traefik / nginx + Let's Encrypt) and secrets yourself.

## 2 · What Gets Deployed

Four containers you build + six you pull :

| Container | Source | Exposed |
|---|---|---|
| `claudeshop-api` | `apps/api/Dockerfile` | `3001` (internal) |
| `claudeshop-admin` | `apps/admin/Dockerfile` | `3002` (internal) |
| `claudeshop-storefront` | `apps/storefront/Dockerfile` | `3000` (internal) |
| `claudeshop-worker` | `apps/api/Dockerfile` (same image, `CMD=worker`) | none |
| `postgres` (pgvector) | `pgvector/pgvector:pg16` | `5432` (internal) |
| `pgbouncer` | `edoburu/pgbouncer` | `6432` (internal) |
| `redis` | `redis:7-alpine` | `6379` (internal) |
| `meilisearch` | `getmeili/meilisearch:v1.11` | `7700` (internal) |
| `minio` | `minio/minio` | `9000` / `9001` |
| `mailhog` | *dev only — replace with SMTP relay in prod* | — |

Traefik (from Coolify) handles TLS + routing. Only `admin.*`, `shop.*` and `api.*` hostnames face the internet.

## 3 · Path A — Coolify Deployment

### 3.1 One-time setup

```bash
# On Coolify UI
# 1. Add source → Gitea → ClaudeShop repo
# 2. Create a new "Docker Compose" resource pointing at docker-compose.prod.yml
# 3. Attach the .coolify/stack.yaml manifest for typed config
```

### 3.2 Wire secrets

In Coolify → **Secrets** add every variable from `.env.production.example`. Coolify injects them at container start. Required :

- `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `MEILISEARCH_MASTER_KEY`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

### 3.3 Attach domains

| Service | Public host |
|---|---|
| `storefront` | `shop.example.com` |
| `admin` | `admin.shop.example.com` |
| `api` | `api.shop.example.com` |

Coolify auto-provisions Let's Encrypt certs via Traefik. The Traefik labels are already in `docker-compose.prod.yml`.

### 3.4 First deploy

```bash
# From your laptop — push to Gitea
git push gitea main

# Coolify auto-builds + deploys. Watch live logs in the Coolify UI.
# The api container runs `prisma migrate deploy` on boot (see Dockerfile CMD).
```

First run takes ~4 minutes for the three app images to build. Subsequent deploys are ~90 seconds thanks to Docker layer caching.

### 3.5 Bootstrap demo data (optional)

```bash
# One-shot from any Coolify ssh session
docker exec claudeshop-api pnpm --filter @claudeshop/db seed
# or via the bootstrap script for a fresh environment
./scripts/bootstrap-demo.sh production
```

## 4 · Path B — Generic Docker Host

### 4.1 Provision

```bash
# On a fresh Ubuntu 24.04 VPS with docker + docker-compose plugin
git clone https://github.com/Skill2Cochon/ClaudeShop.git /opt/claudeshop
cd /opt/claudeshop
cp .env.production.example .env.production
# Edit .env.production with real secrets + domains
```

### 4.2 Build + start

```bash
# Build all 4 images (api, admin, storefront, worker-shares-image)
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Start the stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Tail logs
docker compose -f docker-compose.prod.yml logs -f api admin storefront worker
```

### 4.3 Migrations on boot

The API image runs :

```dockerfile
CMD ["sh", "-c", "pnpm --filter @claudeshop/db migrate:deploy && node apps/api/dist/server.js"]
```

So every deploy applies pending migrations before the server comes up. Set `DIRECT_URL` to bypass PgBouncer for the migration step.

### 4.4 TLS (pick one)

**Option 1 — Caddy** (easiest, auto-HTTPS) :

```caddyfile
shop.example.com {
  reverse_proxy localhost:3000
}
admin.shop.example.com {
  reverse_proxy localhost:3002
}
api.shop.example.com {
  reverse_proxy localhost:3001
}
```

**Option 2 — nginx + certbot** — see `docs/runbooks/nginx-certbot.md` *(placeholder, add when ready)*.

**Option 3 — Traefik** — the labels are already in `docker-compose.prod.yml`; just enable the Traefik service block.

## 5 · Secrets

> [!important] Where secrets live in production
> - **Coolify (Path A)** : built-in secret manager, encrypted at rest, injected as env vars
> - **Generic (Path B)** : `.env.production` on the host, `chmod 600`, owned by root or a dedicated user
> - **Never** : committed to git, in Dockerfiles (use `--secret` mounts instead), or in container images

Required secrets are validated at API boot — if anything is missing the container exits with a clear error (`apps/api/src/config/require-env.ts`). This is intentional : fail fast in a restart loop rather than serve a broken app.

## 6 · Migrations on Boot

The API container's entrypoint runs :

```bash
pnpm --filter @claudeshop/db migrate:deploy
```

This is safe to run on every boot — Prisma applies only pending migrations. For zero-downtime upgrades :

1. Make migrations **additive** (new tables, new nullable columns, new indexes CONCURRENTLY)
2. Deploy the new API image alongside the old one
3. Cut traffic over
4. Run cleanup migrations (DROP columns, DROP tables) in a follow-up deploy after 24h of stable metrics

> [!warning] Destructive migrations
> Never ship a `DROP COLUMN` in the same deploy that stops reading it — you'll break rolling updates. ADR-002 documents the two-phase pattern.

## 7 · Health Checks + Observability

| Endpoint | Purpose |
|---|---|
| `GET /health` (API) | Liveness — returns 200 + git SHA |
| `GET /health/ready` (API) | Readiness — checks DB + Redis + Meilisearch |
| `GET /api/health` (Admin) | Next.js health (returns 200 when `.next/BUILD_ID` exists) |
| `GET /api/health` (Storefront) | Next.js health |

Wire these into Uptime Kuma on your deploy host (already part of the self-hosted stack). Thresholds :
- 3 consecutive failures → alert on Telegram
- 5 consecutive failures → Circuit breaker trips → rollback to last stable image

OpenTelemetry traces export to the OTel collector on `your observability host` — set `OTEL_EXPORTER_OTLP_ENDPOINT` accordingly.

## 8 · Backups

> [!tldr] 3-2-1 backup rule
> 3 copies · 2 different media · 1 offsite. Target : RPO = 1h, RTO = 30 min.

| Target | Tool | Schedule |
|---|---|---|
| `postgres` | `pg_dump` → MinIO bucket `backups/postgres/` | Hourly incremental, daily full |
| `minio` media | `mc mirror` → offsite S3 | Daily |
| Coolify config + secrets | Coolify's built-in backup to your data host | Daily |
| Git (code) | Gitea → GitHub mirror | On every push |

Restore procedure is documented in `docs/runbooks/disaster-recovery.md` *(placeholder)*.

## 9 · Rollback

If a deploy goes bad :

**Coolify (Path A)** :
```
# In Coolify UI → Deployments → click "Rollback" on the last green deploy.
# Takes ~30s — Coolify re-pulls the prior image tag.
```

**Generic (Path B)** :
```bash
cd /opt/claudeshop
git log --oneline -10                      # find the last good commit
git checkout <sha>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Circuit breaker auto-trigger (from the platform operations spec) :
- 3 failed health checks, CPU/RAM >95% for 5 min, or a critical service down
- Response : STOP → REVERT to last stable image → RESTART → ALERT Telegram

## 10 · Pre-Flight Checklist

> [!important] Before the first production deploy
> - [ ] All secrets set in Coolify (or `.env.production` with `chmod 600`)
> - [ ] `AUTH_SECRET` is `openssl rand -base64 32` (not the example value)
> - [ ] `STRIPE_*` keys are live, not test
> - [ ] Stripe webhook endpoint registered at `https://api.shop.example.com/v1/webhooks/stripe`
> - [ ] Domain DNS A-records point at the Coolify host (or Cloudflare proxied)
> - [ ] Uptime Kuma health checks configured for all 3 public hosts
> - [ ] Backup bucket exists in MinIO (`backups/postgres/`, `backups/media/`)
> - [ ] `SEED_DEMO=false` in production env (no demo user reachable)
> - [ ] First admin provisioned via `pnpm --filter @claudeshop/db create-admin`
> - [ ] GitNexus blast-radius check is clean on the deploy commit
> - [ ] Dead man's switch heartbeat from api container working (ping Uptime Kuma every 2 min)

## 11 · Cost Estimate (monthly, Coolify / your deploy host)

| Line item | EUR |
|---|---|
| Coolify host (your deploy host — 2 vCPU / 8 GB) | ~15 |
| Postgres (your data host) | ~10 |
| Redis + Meilisearch + MinIO on your observability host/#2 | included |
| Domain names (3 subdomains) | ~1 |
| Cloudflare (free tier) | 0 |
| SMTP relay (Brevo / Postmark free tier) | 0 |
| Anthropic API (Sonnet 4.7, merchant copilot) | 20-80 depending on usage |
| **Total** | **~50-100 / month for a real store** |

Fits inside the indicative operating budget (EUR 200/mo).

## Related

- [[getting-started|Getting Started]]
- [[configuration|Configuration]]
- [[admin-tour|Admin Tour]]
- [[../../CLAUDE|CLAUDE.md]]
- [[../adrs/ADR-001-monorepo-tooling|ADR-001 Monorepo Tooling]]
- [[../adrs/ADR-002-multi-tenant-strategy|ADR-002 Multi-Tenant Strategy]]
- `docs/runbooks/disaster-recovery.md` *(placeholder)*
- `docs/runbooks/nginx-certbot.md` *(placeholder)*
