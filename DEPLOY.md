---
title: DEPLOY
aliases:
  - Deploy Summary
tags:
  - type/runbook
  - project/claudeshop
status: stable
updated: 2026-04-20
---

# DEPLOY — Quick Reference

> [!tldr] One-page cheat sheet.
> The full guide lives in [[docs/handbook/deployment|docs/handbook/deployment]]. This file is the "I just need the commands" view pinned at the repo root.

## Coolify (Path A)

```bash
# 1. Push to Gitea — Coolify auto-builds from main
git push gitea main

# 2. First-time bootstrap (inside a Coolify ssh session)
./scripts/bootstrap-demo.sh production
```

Pre-requisites :
- Coolify resource pointed at `docker-compose.prod.yml` with `.coolify/stack.yaml` attached
- All secrets from `.coolify/stack.yaml#secrets.required` set in Coolify secret manager
- DNS A records for `shop.*`, `admin.*`, `api.*` pointing at the Coolify host
- `edge` network overridden to `coolify` (see manifest bottom)

## Generic Docker Host (Path B)

```bash
# 1. Clone + configure
git clone https://github.com/Skill2Cochon/ClaudeShop.git /opt/claudeshop
cd /opt/claudeshop
cp .env.production.example .env.production
$EDITOR .env.production   # fill real secrets

# 2. Build + start
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 3. Bootstrap (migrations + optional demo seed)
./scripts/bootstrap-demo.sh production
```

Wire TLS via Caddy / Traefik / nginx — see [[docs/handbook/deployment#4.4 · TLS pick one|Deployment § TLS]].

## Manual Operations

| Task | Command |
|---|---|
| Apply pending migrations | `docker compose exec api pnpm --filter @claudeshop/db migrate:deploy` |
| Create an admin user | `docker compose exec api pnpm --filter @claudeshop/db create-admin -- --email=… --password=…` |
| Create a new tenant | `docker compose exec api pnpm --filter @claudeshop/db create-tenant -- --slug=… --name=… --admin-email=…` |
| Reindex Meilisearch | `docker compose exec api node apps/api/dist/scripts/reindex-search.js` |
| Database backup now | `docker compose exec postgres pg_dump -U claudeshop claudeshop \| gzip > backup-$(date +%F).sql.gz` |
| Tail logs | `docker compose logs -f api admin storefront worker` |
| Roll back last deploy | Coolify UI → Deployments → Rollback   or   `git checkout <prev-sha> && docker compose build && up -d` |

## Health Endpoints

| URL | Expected |
|---|---|
| `https://api.shop.example.com/health` | `{ "status": "ok", "sha": "…" }` |
| `https://admin.shop.example.com/api/health` | 200 |
| `https://shop.example.com/api/health` | 200 |

Wire these into any uptime monitor (e.g. Uptime Kuma) per your infra's runbook.

## Security Checklist Before Go-Live

See [[docs/handbook/deployment#10 · Pre-Flight Checklist|Deployment § Pre-Flight]] — every box must be checked.

## Related

- [[docs/handbook/deployment|Full deployment guide]]
- [[docs/handbook/configuration|Configuration reference]]
- [[docker-compose.prod.yml|Production compose]]
- [[.coolify/stack.yaml|Coolify manifest]]
- [[.env.production.example|Env template]]
