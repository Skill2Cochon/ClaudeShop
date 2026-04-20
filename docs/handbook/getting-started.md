---
title: Getting Started
aliases:
  - Onboarding
  - First Run
tags:
  - type/handbook
  - handbook/getting-started
  - project/claudeshop
status: stable
updated: 2026-04-20
---

# Getting Started with ClaudeShop

> [!abstract] 5 minutes from `git clone` to a running store.
> This note walks you through a fresh local bootstrap, first admin login, and the five places a new merchant should check first. For production deploys see [[deployment|Deployment]]. For env-var details see [[configuration|Configuration]].

**See also** :: [[../../README|README]] · [[../../CLAUDE|Project Context]] · [[configuration|Configuration]] · [[admin-tour|Admin Tour]] · [[deployment|Deployment]]

## 1 · Prerequisites

> [!important] Required tooling
> - **Node.js 22+** (check with `node -v`)
> - **pnpm 10+** (`npm i -g pnpm@10`)
> - **Docker Desktop** running (provides Postgres, Redis, Meilisearch, MinIO, Mailhog)
> - **Git** with access to the ClaudeShop repo
> - ~4 GB free RAM for the local stack

Optional but recommended :: a code editor with TypeScript + ESLint support (VS Code, Cursor, WebStorm), and the Anthropic Claude Code CLI for the built-in copilot flows.

## 2 · First Bootstrap

```bash
# 1. Clone
git clone https://github.com/Skill2Cochon/ClaudeShop.git
cd claudeshop

# 2. Install JS deps (workspaces + catalog versions)
pnpm install

# 3. Copy env template — edit AUTH_SECRET + STRIPE keys later
cp .env.example .env

# 4. Start local infra (Postgres + Redis + Meilisearch + MinIO + Mailhog + PgBouncer)
pnpm docker:up

# 5. Prisma client + migrations + demo seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 6. Run all three apps in parallel (Turborepo)
pnpm dev
```

Expected output — three green lines roughly within 10 seconds of each other :

- `storefront ready on http://localhost:3000`
- `api listening on http://localhost:3001`
- `admin ready on http://localhost:3002`

> [!tip] Troubleshooting a stuck bootstrap
> - `pnpm docker:down` then `pnpm docker:up` resets containers without wiping volumes.
> - `pnpm docker:reset` **destroys** volumes — use when the schema is out of sync with the seed.
> - If `pnpm db:migrate` prompts about drift, accept the reset in dev; refuse in production and run `pnpm db:migrate:deploy` instead (see [[deployment#Migrations on boot|Deployment § Migrations on boot]]).

## 3 · First Admin Login

The seed (`packages/db/src/seed.ts`) creates a **demo tenant** + admin user :

| Field | Value |
|---|---|
| Tenant slug | `demo` |
| Admin email | `demo@claudeshop.local` |
| Admin password | `demo-admin-1234` |
| Locale | `en` (also seeded : `fr`, `de`, `es`) |
| Currency | `EUR` |

1. Open [http://localhost:3002/login](http://localhost:3002/login)
2. Sign in with the demo credentials
3. You land on the **Dashboard** — orders/revenue KPIs, AOV sparkline, low-stock digest
4. Change the password from **Settings → Security** before anything else

> [!warning] Demo creds are for local only
> Never deploy with the seeded demo user reachable. In [[deployment|production]] the seed runs with `SEED_DEMO=false` or a fresh admin is provisioned via `pnpm --filter @claudeshop/db create-admin -- --email=… --password=…`.

## 4 · The Five Places to Check First

> [!tldr] A new merchant's 15-minute orientation
> Open these five surfaces in order — each one is a click from the sidebar.

| # | Where | Why it matters first |
|---|---|---|
| 1 | **Settings → Site** | Store name, logo, default locale/currency, contact email |
| 2 | **Settings → Payments** | Activate Stripe / Mollie adapters (test keys from `.env`) |
| 3 | **Settings → Shipping Rates** | Define carriers + weight brackets — orders can't checkout without a rate |
| 4 | **Settings → Tax Rates** | VAT / sales tax per region — critical for EU merchants |
| 5 | **Products** | Add the first real product (CSV import available from the top-right) |

Each surface is documented in [[admin-tour|Admin Tour]].

## 5 · The Copilot — Claude Inside the Admin

Press **Ctrl-K** (or **⌘-K** on macOS) anywhere in the admin to open the command palette. Type :

- `create product organic cotton hoodie in black and grey, EUR 59` — Claude drafts the product, **shows a diff preview**, you click **Apply** to persist
- `find orders from last week with status fulfilment_pending` — jumps directly to a filtered orders list
- `explain audit log entry #4421` — opens the audit drawer with a plain-English summary

> [!info] Merchant sovereignty
> Every mutating copilot action goes through a **diff preview + click-to-confirm** gate. Claude never writes without your explicit approval. Read-only queries (search, summaries, explanations) run immediately.

Full copilot reference :: [[admin-tour#AI — Copilot + Palette|Admin Tour § AI]].

## 6 · What to Read Next

- [[configuration|Configuration]] — `.env` glossary + multi-tenant + secrets rotation
- [[admin-tour|Admin Tour]] — the 22 admin surfaces, one paragraph each
- [[deployment|Deployment]] — Docker + Coolify + production checklist
- [[../../CLAUDE|CLAUDE.md]] — full project context + active skill stack
- [[../../.claude/plan/claudeshop-v1-0|v1.0 Plan]] — the 6-phase roadmap

## 7 · Stop / Start / Reset Cheat Sheet

```bash
# Stop everything (keep volumes)
pnpm docker:down

# Restart infra only
pnpm docker:up

# Wipe local DB + seeds (dev only)
pnpm docker:reset
pnpm db:migrate
pnpm db:seed

# Stop dev servers : Ctrl-C in the terminal running `pnpm dev`
```

Related :: [[configuration|Configuration]] · [[admin-tour|Admin Tour]] · [[deployment|Deployment]]
