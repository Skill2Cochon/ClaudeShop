---
title: Dev Bootstrap Runbook
aliases:
  - Dev Setup
  - Getting Started
tags:
  - type/runbook
  - project/claudeshop
  - phase/1
status: active
updated: 2026-04-18
---

# Dev Bootstrap — from `git clone` to `pnpm dev`

> [!info] Objectif
> Obtenir **storefront + admin + API** tournant en local en moins de 10 minutes sur une machine propre (Windows / macOS / Linux).

## Prérequis

> [!important] Outils obligatoires
> - **Node 22 LTS** — check via `node --version`. Install via [nvm](https://github.com/nvm-sh/nvm) ou [fnm](https://github.com/Schniz/fnm) · Windows : installer depuis nodejs.org.
> - **pnpm 10.33+** — `npm install -g pnpm@latest`
> - **Docker Desktop** (ou Docker Engine sous Linux) — requis pour Postgres + Redis + Meilisearch + MinIO + Mailhog. Download : https://www.docker.com/products/docker-desktop
> - **Git** — 2.40+ recommandé

Vérification rapide :

```bash
node --version    # v22.x ou supérieur
pnpm --version    # 10.x
docker --version  # 27.x ou 28.x
git --version     # 2.40+
```

## Étape 1 — Clone + install

```bash
git clone https://github.com/Skill2Cochon/ClaudeShop.git claudeshop
cd claudeshop
pnpm install
```

`pnpm install` doit afficher `Done in ~30s using pnpm v10.x` et installer ~520 packages dans `node_modules/`.

## Étape 2 — Variables d'environnement

```bash
cp .env.example .env
```

Puis édite `.env` avec tes vraies valeurs (au minimum) :

```
AUTH_SECRET=$(openssl rand -base64 32)
DATABASE_URL=postgresql://claudeshop:claudeshop@localhost:5432/claudeshop?schema=public
REDIS_URL=redis://localhost:6379
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=devMasterKeyChangeInProd
```

Les clés **Stripe** et **Anthropic** sont optionnelles en Phase 1 (features AI activées Phase 4).

## Étape 3 — Infrastructure Docker

```bash
pnpm docker:up
```

Ça lance 6 containers :

| Service | Port | Check |
|---|---|---|
| postgres (pgvector/pg16) | 5432 | `docker exec claudeshop-postgres pg_isready` |
| pgbouncer (pooler) | 6432 | pings transitivement |
| redis 7 | 6379 | `docker exec claudeshop-redis redis-cli ping` |
| meilisearch 1.11 | 7700 | `curl http://localhost:7700/health` |
| minio (S3) | 9000 / 9001 (console) | open http://localhost:9001 |
| mailhog (SMTP sink) | 1025 / 8025 (UI) | open http://localhost:8025 |

Premier démarrage : **~2 min** pour pull images + init. Ensuite `pnpm docker:up` redémarre en ~5s.

> [!tip] Reset complet
> ```bash
> pnpm docker:reset   # down -v + up
> ```
> Supprime les volumes Postgres/Redis/Meilisearch/MinIO. Utile quand une migration a foiré.

## Étape 4 — Prisma migrate + seed

```bash
pnpm db:generate              # génère le client TS à partir du schema
pnpm db:migrate               # applique toutes les migrations + RLS policies
pnpm db:seed                  # crée le tenant demo + 1 produit test
```

La commande `db:migrate` appelle `prisma migrate dev` qui applique :
1. Migration initiale `20260419000000_init/` (tables)
2. Migration `20260419000000_rls/` ([[../../packages/db/prisma/migrations/20260419000000_rls/migration.sql|RLS policies]])

> [!warning] RLS + dev
> Le rôle `claudeshop_app` est créé par `docker/postgres/init/02-roles.sql`. Le pool applicatif l'utilise pour déclencher les RLS policies. L'owner `claudeshop` bypass RLS — pratique pour Prisma Studio, dangereux en prod.

## Étape 5 — Lancer le dev stack

```bash
pnpm dev
```

Turborepo lance en parallèle :

| Process | URL | Description |
|---|---|---|
| `@claudeshop/api` | http://localhost:3001 | Fastify + GraphQL Yoga + OpenAPI (`/openapi.json`) |
| `@claudeshop/storefront` | http://localhost:3000 | Next.js 16 — Home + `/[locale]` + PDP `/[locale]/p/[slug]` |
| `@claudeshop/admin` | http://localhost:3002 | Next.js 16 admin shell — `/login` → `/dashboard` |

Ouvre :
- http://localhost:3000 → storefront home
- http://localhost:3000/en/p/hello-claudeshop-tee → PDP du produit seedé
- http://localhost:3002 → admin (login stub Phase 1)
- http://localhost:3001/healthz → API health

## Étape 6 — Tester l'API avec curl

```bash
# Liveness
curl http://localhost:3001/healthz
# => { "data": { "status": "ok", "uptime": 42 } }

# Product fetch (tenant header required Phase 1)
curl -H "x-tenant-id: $(pnpm --silent db:seed 2>&1 | grep 'Demo tenant ready' | awk '{print $4}')" \
     http://localhost:3001/v1/products/hello-claudeshop-tee
# => { "data": { "id": "...", "slug": "hello-claudeshop-tee", ... } }
```

## Commandes utiles

| Goal | Command |
|---|---|
| Run all tests | `pnpm test` |
| Run one package tests | `pnpm --filter @claudeshop/core test` |
| Watch tests | `pnpm --filter @claudeshop/core test:watch` |
| Typecheck everything | `pnpm typecheck` |
| Format code | `pnpm format` |
| Open Prisma Studio | `pnpm db:studio` |
| Check Docker health | `docker compose ps` |
| Tail all logs | `pnpm docker:logs` |
| Reset DB (destructive) | `pnpm docker:reset && pnpm db:migrate && pnpm db:seed` |

## Troubleshooting

> [!bug] Connection refused to localhost:5432
> Docker Desktop n'est pas démarré, OU le port est pris par un Postgres natif. `docker compose ps` doit montrer `postgres` en `healthy`.

> [!bug] `prisma migrate dev` bloque sur un lock
> Une ancienne session Prisma traîne. `pnpm docker:reset` + retry.

> [!bug] `pnpm dev` échoue avec `MODULE_NOT_FOUND`
> Tu as ajouté une dep sans réinstall. Refais `pnpm install` puis `pnpm db:generate` si le client Prisma est concerné.

> [!bug] Port 3000 déjà utilisé
> Un autre Next.js tourne. Ports par défaut : storefront 3000, admin 3002, API 3001 — change `PORT` dans `.env` si besoin.

> [!bug] Windows + symlinks Prisma
> Si `pnpm db:generate` échoue avec "EPERM: operation not permitted, symlink", active le Developer Mode Windows (Settings → Privacy & Security → For developers).

## Prochaines étapes après bootstrap

- [[../../.claude/plan/claudeshop-v1-0#Phase 1 — Bootstrap Semaine 1-2|Plan Phase 1 checklist]] pour valider que tout est en place
- [[../../_meta/MOC|Vault MOC]] pour naviguer la doc
- `/gsd:next` (via Claude Code) pour proposer la prochaine tâche Phase 2

## Related

- [[../adrs/ADR-001-monorepo-tooling|ADR-001 Monorepo Tooling]]
- [[../adrs/ADR-002-multi-tenant-strategy|ADR-002 Multi-tenant Strategy]]
- [[../../docker-compose.yml|docker-compose.yml]]
- [[../../packages/db/prisma/schema.prisma|Prisma schema]]
