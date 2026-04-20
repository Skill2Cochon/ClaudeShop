---
title: ClaudeShop — README
aliases:
  - README
tags:
  - project/claudeshop
  - type/project-context
status: active
---

# ClaudeShop

> [!info] The modern commerce CMS — PrestaShop v150 under steroids for 2026.
> Headless, **Claude-native**, B2B-first e-commerce platform. Built on Node 22 + TypeScript + Fastify + Next.js 16 + PostgreSQL 16. Apache-2.0, no commercial tier.

**See also** :: [[CLAUDE|Project Context]] · [[.claude/install|Install Playbook]] · [[_meta/MOC|Vault MOC]] · [[.claude/plan/claudeshop-v1-0|v1.0 Plan]] · [[architecture.canvas|Architecture Canvas]]

## One-line install

> [!tldr] Ask Claude to do it
> ```
> install https://github.com/Skill2Cochon/ClaudeShop.git
> ```
> or inside Claude Code :
> ```
> /plugin marketplace add Skill2Cochon/ClaudeShop
> /plugin install claudeshop-install@claudeshop
> /install local
> ```
> Claude clones the repo, detects your environment (local / VPS / Coolify), runs the phased install playbook at [`.claude/install.md`](.claude/install.md), and hands off with a summary + first-login credentials.

Prefer plain bash?

```bash
# One line, fresh machine
curl -fsSL https://raw.githubusercontent.com/Skill2Cochon/ClaudeShop/main/install.sh | bash

# Or after cloning
./install.sh [local|vps|coolify]
```

## Why ClaudeShop?

- **Time-to-value 5 minutes** — `./install.sh local` and you're selling.
- **Claude-native** — Semantic search (pgvector + Claude), MCP-based admin copilot, auto-generated copy. Claude is the **runtime brain**, not a bolt-on chatbot.
- **B2B first-class** — Segment price lists, requisition orders, approval workflows, multi-org hierarchy.
- **Typed plugin system** — Zod-validated manifest, capability scopes, 3-tier isolation (in-process / worker / sandbox).
- **Developer joy** — Single source of truth (Zod → Prisma + OpenAPI + GraphQL + UI forms), OpenTelemetry built-in, one-command dev setup.
- **Merchant sovereignty** — every mutation Claude proposes goes through a diff preview + click-to-confirm. The merchant always owns the "apply" button.

## Architecture

Turborepo + pnpm workspaces monorepo :

```
apps/
  api/           Fastify + GraphQL Yoga (Pothos)
  storefront/    Next.js 16 App Router — B2C + B2B
  admin/         Next.js 16 — dashboard with AI copilot
packages/
  contracts/     Zod schemas (single source of truth)
  core/          Domain entities + use-cases (pure TS, hexagonal)
  db/            Prisma 6 (multi-file schema) + migrations + RLS
  sdk/           Auto-generated REST + GraphQL client
  ui/            Shared shadcn/ui components + OKLCH tokens
  events/        Event bus + transactional outbox
  errors/        Typed error envelope
  telemetry/     pino + OpenTelemetry
  module-kit/    Plugin SDK for third-party modules
modules/
  payment-stripe/     payment-mollie/
  shipping-shippo/    ai-recommendations/    analytics-plausible/
plugins/
  claudeshop-install/ Claude Code plugin — install skill + commands + MCP defs
.claude-plugin/       marketplace.json (discoverable by /plugin marketplace add)
.claude/
  install.md          Claude's install playbook (6 phases)
  install-manifest.json
  mcp.json            Recommended MCP servers (gitnexus · claude-mem · basic-memory · mempalace)
  plan/               Phase-by-phase implementation plan
```

## Quick Start (manual)

### Prerequisites

- Node 22+
- pnpm 10+
- Docker Desktop (for Postgres / Redis / Meilisearch / MinIO / Mailhog)

### Bootstrap

```bash
git clone https://github.com/Skill2Cochon/ClaudeShop.git claudeshop
cd claudeshop
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Then :

| Surface | URL | Notes |
|---|---|---|
| Storefront | `http://localhost:3000` | — |
| Admin | `http://localhost:3002` | Login `demo@claudeshop.local / demo-admin-1234` |
| API | `http://localhost:3001` | — |
| API docs (Scalar) | `http://localhost:3001/docs` | — |
| Mailhog | `http://localhost:8025` | SMTP dev sink |
| MinIO console | `http://localhost:9001` | Object storage |

## Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps + packages
pnpm lint             # Lint the whole monorepo
pnpm typecheck        # TypeScript strict check
pnpm test             # Run all unit tests (Vitest)
pnpm test:e2e         # Run Playwright E2E tests
pnpm format           # Format with Prettier

pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Create a new migration (dev)
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed sample data

pnpm docker:up        # Start local infra
pnpm docker:down      # Stop local infra
pnpm docker:reset     # Reset volumes (destructive)
```

## Deploying

- **Local** :: `./install.sh local`
- **Generic VPS / Docker host** :: edit `.env.production` → `./install.sh vps`
- **Coolify** :: `.coolify/stack.yaml` is the typed manifest — see [`docs/handbook/deployment.md`](docs/handbook/deployment.md)

Quick deploy cheat sheet :: [`DEPLOY.md`](DEPLOY.md).

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — project context, stack, active skill stack, model routing
- [`.claude/install.md`](.claude/install.md) — Claude install playbook (phases + checkpoints)
- [`SECURITY.md`](SECURITY.md) · [`AUDIT.md`](AUDIT.md) — security policy + pre-launch audit
- [`docs/handbook/`](docs/handbook/) — operator guide : getting-started, configuration, admin-tour, deployment
- [`docs/adrs/`](docs/adrs/) — architecture decision records
- [`_meta/MOC.md`](_meta/MOC.md) — vault map of content
- [`_meta/references.md`](_meta/references.md) — reference repos to benchmark against
- [`architecture.canvas`](architecture.canvas) + [`phases.base`](phases.base) + [`risks.base`](risks.base) — Obsidian-native visuals

## Status

**Phases 1-59 shipped.** Bootstrap, core commerce, multi-tenant, B2B, AI-native surfaces, plugin scaffold, ERP, CRM, auditable webhooks, CSV exports, Obsidian vault — all in `main`. See [`.claude/plan/claudeshop-v1-0.md`](.claude/plan/claudeshop-v1-0.md) for the 6-phase v1.0 roadmap (~6 months).

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) § *Development Rules* + [`SECURITY.md`](SECURITY.md) before you open a PR. TDD is mandatory, conventional commits are required, GitNexus impact analysis must be run before any cross-module edit.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). OSS forever. No commercial tier.
