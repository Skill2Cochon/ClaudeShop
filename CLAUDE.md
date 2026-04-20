---
title: ClaudeShop — Project Context
aliases:
  - ClaudeShop
  - Claude Shop
  - ClaudeShop CMS
  - ClaudeShop Business OS
tags:
  - project/claudeshop
  - type/project-context
  - phase/1
status: active
phase: 1
started: 2026-04-18
stack: comprehensive+obsidian-full
cssclasses:
  - claudeshop
scope:
  - CMS
  - ERP
  - CRM
  - API
  - NPM
  - CLI
  - Agents+Skills
claude_role: runtime-brain
vision: claude-native-business-os
---

# ClaudeShop — The Claude-Native Business OS

> [!info] Mission
> **More than an e-commerce CMS.** ClaudeShop is a platform where **Claude is the runtime brain** giving merchants a full view of their app and the power to act at **every level of the stack**. Claude = the onboarding chatbot, the companion to modify the CMS, the ERP, the CRM, the API, the NPM modules, the CLI, and the agents (Claude + Skills).
>
> "Best-in-class, in the best possible stack, for **every trade** — physical goods **and** digital."
>
> **One OSS repo** delivering what traditional CMSes offer… done better. Forever.

> [!tldr] Scope — 7 surfaces, 1 platform
> | Surface | Claude can |
> |---|---|
> | **CMS** (catalog + pages + storefront) | create products/pages by conversation, generate copy, translate, optimise SEO |
> | **ERP** (stock + suppliers + purchases) | forecast demand, draft POs, manage multi-warehouse inventory |
> | **CRM** (customers + segments + marketing) | segment, draft emails, answer tickets, qualify leads |
> | **API** (REST + GraphQL) | propose endpoints, version them, generate OpenAPI docs, contract-test |
> | **NPM modules** (`modules/*`) | scaffold a new module, implement lifecycle, publish to registry |
> | **CLI** (`claudeshop` command) | run admin ops, import scripts, migrations, backups |
> | **Agents + Skills** | create/modify Claude agents, audit skills, propose new capabilities |
>
> Claude sees everything, proposes everything, but **never applies without click-to-confirm** (AI safety rule).

## Vision Principles

> [!important] 6 non-negotiable principles
> 1. **Claude-native, not Claude-added.** Every surface exposes an MCP server. Claude talks to the system natively, not through hacky wrappers.
> 2. **Merchant sovereignty.** The merchant sees the code / config / data Claude intends to modify. Diff preview mandatory. Confirm-to-execute required on every mutation.
> 3. **Universal trade coverage.** Adapts to the florist (physical), the SaaS (digital / subscriptions), the hybrid (training + goodies). No vertical lock-in.
> 4. **Best-in-class, no compromise.** Copy what PrestaShop / Medusa / Saleor / Vendure / Shopify / Shopware do best (see [[_meta/references|References]]), invent the rest.
> 5. **OSS forever.** Apache-2.0 license. No commercial tier. Monetisation via hosted + marketplace modules + services — never by gating features.
> 6. **Self-evolving (Phase 6+).** Vault + code live as a vertical slice with Claude Code — the AI can propose its own improvements via PR on opt-in branches only.

**Active plan** :: [[.claude/plan/claudeshop-v1-0]]
**Vault MOC** :: [[_meta/MOC]]
**Tag taxonomy** :: [[_meta/tags]]
**Architecture** :: [[architecture.canvas|System Canvas]]
**Phases tracker** :: [[phases.base]]
**Risks register** :: [[risks.base]]

## Stack (locked 2026-04-18)

> [!note] Best-in-class stack — no "good enough"
> Every line is justified in an ADR or will be documented. Stack is modular — any brick is swappable via the plugin system (Phase 3+).

| Layer | Tech | Role |
|---|---|---|
| Backend API | Node 22 + TypeScript 5.6 + **Fastify** | REST + GraphQL (Yoga) + MCP server endpoint |
| ORM | **Prisma 6** | Schema + migrations multi-file |
| DB | **PostgreSQL 16** | Catalog + orders + customers + inventory + **ERP + CRM** unified |
| Vector | **pgvector** (inside Postgres) | Semantic search + Claude embeddings |
| Cache | **Redis 7** | Sessions + query cache + rate limit |
| Search | **Meilisearch 1.x** | Faceted search + typo-tolerance (hybrid with pgvector) |
| Queue | **BullMQ** (Redis) | Webhooks, emails, imports, AI batch jobs |
| Storefront | **Next.js 16** (App Router, RSC, Turbopack) | SSR/ISR — physical + digital + subscriptions |
| Admin | **Next.js 16** + **shadcn/ui** + **TanStack Table** | Dashboard + **Claude copilot embedded** |
| CLI | **`claudeshop`** (Commander + Ink) | Ops, imports, modules, sync — Claude-callable |
| Auth | **Auth.js v5** (NextAuth) + API keys + JWT + WebAuthn | Multi-tenant + B2B roles |
| Payments | **Stripe** + **Mollie** adapters (pluggable) | PSP gateway — extensible |
| Shipping | **Shippo** adapter (pluggable) | Multi-carrier — extensible |
| AI Runtime | **Claude API** (Sonnet + Opus current) | **Runtime brain** — MCP native per surface |
| Agents Orchestration | Claude Agent SDK + Claude Code subagents | Complex multi-agent workflows |
| Deploy | **Docker Compose** + **Coolify** (optional) | CI/CD-friendly + one-command bootstrap |
| Observability | **OpenTelemetry** + **pino** + health endpoints | Health + traces + immutable audit |

## Active Skill Stack — Comprehensive + Full Obsidian Addon

> [!note] 20 skills active · ~8 450 tokens (under the 12k ceiling)

### Core stack (Comprehensive)

| Skill | Role | Trigger phrases |
|---|---|---|
| `backend-patterns` | API + auth + repo | "backend", "API", "service" |
| `nextjs-turbopack` | Next.js 16 | "storefront", "admin page", "RSC" |
| `frontend-design` | Production UI | "storefront design", "UI", "landing" |
| `design:design-system` | Design tokens | "design system", "admin UI" |
| `postgres-patterns` | Schema optim | "schema", "query", "index" |
| `database-migrations` | Schema evolution | "migration", "altertable" |
| `api-design` | REST + GraphQL | "API contract", "versioning" |
| `api-tester` | Contract tests | "API test", "endpoint validation" |
| `tdd-workflow` | Test-first | "implement feature", "bugfix" |
| `e2e-testing` | Playwright | "checkout test", "E2E" |
| `security-review` | OWASP | "security", "auth review", "PCI" |
| `docker-patterns` | Compose | "dockerize", "deploy" |
| `claude-api` | Claude SDK | "AI feature", "semantic search" |
| `mcp-server-patterns` | Build MCP | "admin AI", "MCP tool" |
| `architecture-decision-records` | ADRs | "architecture decision", "trade-off" |
| `superpowers:writing-plans` | Phase planning | "plan phase", "feature spec" |

### Obsidian Full Addon

| Skill | Role | Trigger phrases |
|---|---|---|
| `obsidian-markdown` | Wikilinks + callouts + frontmatter | "note", "link to", "callout", any `.md` write |
| `json-canvas` | `.canvas` architecture diagrams | "canvas", "diagram", "visualize" |
| `obsidian-bases` | `.base` tabular views | "base", "track phases", "filter notes" |
| `obsidian-cli` | Headless vault ops | "rename links", "audit vault", "batch" |

## Architecture (vertical slice + modules)

Visual diagram :: [[architecture.canvas]]

```
claudeshop/
├── apps/
│   ├── api/                  # Fastify + GraphQL Yoga (Pothos)
│   ├── storefront/           # Next.js 16 — B2C + B2B, i18n 4 locales
│   └── admin/                # Next.js 16 — dashboard + AI copilot
├── packages/
│   ├── contracts/            # Zod — SINGLE SOURCE OF TRUTH
│   ├── core/                 # Domain (hexagonal, pure TS)
│   ├── db/                   # Prisma 6 + migrations + RLS
│   ├── sdk/                  # Auto-gen REST + GraphQL client
│   ├── ui/                   # shadcn/ui + OKLCH tokens
│   ├── config/               # eslint / tsconfig / tailwind preset
│   ├── telemetry/            # pino + OTel
│   ├── errors/               # Typed envelope
│   ├── events/               # Event bus + topics
│   └── module-kit/           # Plugin SDK
├── modules/                  # Installable plugins (Phase 3+)
├── docs/adrs/                # Architecture Decision Records
├── docs/handbook/            # Operator guide (4 notes)
├── _meta/                    # Vault meta (MOC, tags, dashboards)
├── .claude/                  # Install playbook + repo-local skills
│   ├── install.md
│   ├── install-manifest.json
│   └── plan/                 # Phase plans
└── docker-compose.yml
```

## Development Rules

> [!important] Non-negotiable
> - **Immutable data** — return new copies, never mutate
> - **Files < 800 lines**, functions < 50 lines
> - **TDD mandatory** — RED → GREEN → REFACTOR
> - **Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `perf:`
> - **Git flow** — `main` → `dev` → `feature/*`
> - **Zero trust** — all user input validated via Zod at API boundary
> - **Module isolation** — modules communicate via events (EventEmitter3), never direct imports

## Model Routing

- **Haiku** (cheap/fast) — code-reviewer, doc-updater, build-error-resolver on tight loops
- **Sonnet** (main dev) — feature implementation, server actions, Next.js pages, tests
- **Opus** (deep reasoning) — architecture decisions, plugin system design, complex AI features

## Anti-Patterns

> [!warning] Never do these
> - Never use Prisma `$queryRaw` without Zod validation of results
> - Never expose internal Prisma models — only DTOs from `packages/contracts`
> - Never bypass the module event bus for cross-module communication
> - Never ship Stripe keys in the storefront bundle (server actions only)
> - Never skip TDD on payment, auth, or inventory code (critical paths)
> - Never commit `.env`, `.env.production`, or any file matching `.env.*` except `*.example` variants

## Session Protocol

- **Start** :: Read this file → check [[.claude/plan/claudeshop-v1-0#Phase 1 — Bootstrap Semaine 1-2|current phase]] → resume where left off
- **End** :: Update phase status → commit → push

## Installing This Repo (for Claude)

When a Claude session is asked `install https://github.com/Skill2Cochon/ClaudeShop.git`, follow [[.claude/install|.claude/install.md]]. That playbook handles:

1. Clone + optional worktree
2. Detect target environment (local / VPS / Coolify / generic Docker)
3. Install runtime deps (pnpm, docker) if missing
4. Bootstrap infra + migrations + optional seed
5. Register MCP servers the repo ships (`.claude/mcp.json`)
6. Hand off with a summary + first-login credentials

## Related Notes

- [[README|README]] — public overview + quick start
- [[DEPLOY|DEPLOY.md]] — deploy cheat sheet
- [[.claude/install|Install playbook]] — Claude-as-installer
- [[.claude/plan/claudeshop-v1-0|v1.0 Implementation Plan]]
- [[_meta/MOC|Vault Map of Content]]
- [[docs/handbook/getting-started|Handbook: Getting Started]]
- [[docs/adrs/ADR-001-monorepo-tooling|ADR-001 Monorepo Tooling]]
- [[docs/adrs/ADR-002-multi-tenant-strategy|ADR-002 Multi-Tenant Strategy]]

## Local Overrides

Private / environment-specific context (your infrastructure, credentials references, personal conventions) belongs in **`.claude/CLAUDE.local.md`** — gitignored, never shipped. Copy from `.claude/CLAUDE.local.md.example` if you need a starting point.
