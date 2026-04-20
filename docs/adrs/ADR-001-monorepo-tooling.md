---
title: ADR-001 — Monorepo Tooling (pnpm + Turborepo)
aliases:
  - ADR-001
tags:
  - type/adr
  - adr/accepted
  - decision/stack
  - project/claudeshop
  - phase/1
adr_id: "001"
status: accepted
date: 2026-04-18
decision_makers:
  - ClaudeShop Maintainers
supersedes: null
superseded_by: null
---

# ADR-001 — Monorepo Tooling : pnpm + Turborepo

> [!success] Status
> **Accepted** · 2026-04-18 · effect immédiat (Phase 1 Bootstrap)

## Context

ClaudeShop est un monorepo fullstack Node/TypeScript contenant :

- 3 apps : `apps/api`, `apps/storefront`, `apps/admin`
- ~10 packages partagés : `contracts`, `core`, `db`, `sdk`, `ui`, `events`, `errors`, `telemetry`, `module-kit`, `config`
- N modules installables dans `modules/*`

Le choix de l'outillage monorepo impacte :

- DX (cold dev start, hot reload, tasks running)
- CI (build time, cache hits, affected-only tests)
- Publishing (packages publics vers registry privé Verdaccio)
- Boundaries enforcement (éviter imports illicites `apps → db`)

## Decision

**Utiliser `pnpm` workspaces + `Turborepo` comme task runner.**

```
pnpm-workspace.yaml → packages: [apps/*, packages/*, modules/*]
turbo.json          → pipeline build/dev/lint/typecheck/test avec deps graph
```

## Options considérées

| Option | Pros | Cons |
|---|---|---|
| **pnpm + Turborepo** (choisi) | Strict hoisting match Fastify isolation · Turborepo task graph + remote cache · ecosystem Vercel-backed · <200 lignes config | Turborepo rate-limit sur cloud (mais self-hosted possible via MinIO) |
| Nx | Mega-powerful generators, affected graph | Heavy DSL, generators drift from native tooling, over-engineered pour ~15 packages |
| Pure pnpm workspaces | Simple, no extra tool | No task graph, no remote cache, no affected-only CI |
| Yarn Berry + workspaces | PnP + zero-install | PnP casse Prisma/Next.js plugins, community shrinking |
| Lerna | Historical de facto | En maintenance, no cache, no modern DX |

## Consequences

### Positive

- ✅ `pnpm install` 3-5× faster que npm/yarn sur monorepos
- ✅ Hoisting strict = pas de fantom deps (un package voit uniquement ses deps déclarées)
- ✅ Turborepo cache local + remote (self-hosted `turbo-remote-cache` sur your cache host) → CI builds < 30s avec cache hit
- ✅ Affected-only CI : `turbo run test --filter=[origin/main]` → ne run que ce qui a changé
- ✅ Stack aligné avec le document de contexte projet (cf. [[../../CLAUDE|CLAUDE.md]] : "préférer pnpm")

### Negative

- ⚠️ Turborepo est commercial (Vercel) mais OSS core → risque de verrouillage si on dépend du cloud cache
  - **Mitigation** : remote cache self-hosté via `turbo-remote-cache` sur MinIO (your data host)
- ⚠️ pnpm `strict-peer-dependencies` peut casser avec des packages tiers mal configurés
  - **Mitigation** : `strict-peer-dependencies=false` dans `.npmrc`
- ⚠️ IDE integration (VSCode TypeScript) nécessite `public-hoist-pattern` pour les types
  - **Mitigation** : déjà configuré dans `.npmrc`

### Neutral

- Turborepo `ui: "tui"` offre un dashboard des tasks — bon DX mais encore early (v2.x)

## Enforcement

```yaml
# Package boundaries — voir eslint-plugin-boundaries dans packages/config/eslint-base.js
contracts → nothing
core → contracts, errors, events
db → contracts (types only)
api → core, db, contracts, telemetry, events, errors
modules/* → module-kit, contracts, events (jamais core/db/modules direct)
apps/* → sdk, contracts, ui (jamais db/core/api internals)
```

## Follow-ups

- [ ] Configurer `turbo-remote-cache` sur your cache host (Phase 1.5)
- [ ] Ajouter `eslint-plugin-boundaries` avec la matrice ci-dessus (Phase 2)
- [ ] Mesurer cache hit rate en CI après 1 mois (Phase 2)

## Related ADRs

- [[ADR-002-multi-tenant-strategy|ADR-002 — Multi-tenant DB Strategy]] (Prisma schema / RLS choix)
- [[ADR-003-plugin-isolation-tiers|ADR-003 — Plugin Isolation Tiers]] *(Phase 3, draft)*

## References

- [[../../.claude/plan/claudeshop-v1-0#1 Strategic Vision|Plan § Strategic Vision]]
- Turborepo docs : https://turbo.build/repo/docs
- pnpm workspaces : https://pnpm.io/workspaces
