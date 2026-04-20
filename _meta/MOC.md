---
title: ClaudeShop — Map of Content
aliases:
  - MOC
  - Vault Index
  - Home
tags:
  - type/moc
  - project/claudeshop
cssclasses:
  - moc
---

# ClaudeShop Vault — Map of Content

> [!abstract] Vault hub
> Landing page for the ClaudeShop Obsidian vault. Start here to navigate the project: context, plan, phases, risks, references, ADRs.

## Core Documents

- [[../CLAUDE|Project Context (CLAUDE.md)]] — tech stack, rules, model routing, active skill stack
- [[../README|README]] — public-facing overview + quick start
- [[../.claude/plan/claudeshop-v1-0|v1.0 Implementation Plan]] — 6 phases, 15 risks, success criteria

## Handbook (operator guide)

- [[../docs/handbook/getting-started|Getting Started]] — bootstrap in 5 minutes, first admin login, 5-place orientation
- [[../docs/handbook/configuration|Configuration]] — `.env` glossary, multi-tenant setup, secrets rotation
- [[../docs/handbook/admin-tour|Admin Tour]] — the 22 admin surfaces, one paragraph each
- [[../docs/handbook/deployment|Deployment]] — Coolify path, generic Docker path, pre-flight checklist

## Visual & Data

- [[../architecture.canvas|Architecture Canvas]] — system diagram (apps, packages, modules, infra)
- [[../phases.base|Phases Base]] — tracker with status per phase
- [[../risks.base|Risks Base]] — register with severity + mitigation

## Architecture Decisions

- [[../docs/adrs/ADR-001-monorepo-tooling|ADR-001 Monorepo Tooling]]
- [[../docs/adrs/ADR-002-multi-tenant-strategy|ADR-002 Multi-Tenant DB Strategy]]
- [[../docs/adrs/ADR-003-plugin-isolation-tiers|ADR-003 Plugin Isolation (Phase 3)]] *— placeholder*
- [[../docs/adrs/ADR-004-ai-admin-safety|ADR-004 AI Admin Safety (Phase 4)]] *— placeholder*
- [[../docs/adrs/ADR-005-b2b-data-model|ADR-005 B2B Data Model (Phase 4)]] *— placeholder*

## Meta

- [[tags|Tag Taxonomy]] — namespaces `#phase/*`, `#risk/*`, `#module/*`, `#adr/*`, `#decision/*`
- [[references|External References]] — PrestaShop, Medusa, Saleor, Vendure, Hydrogen source indexes

## Phases (tracker)

- `#phase/1` — Bootstrap (Sem 1-2) — **current**
- `#phase/2` — Core Commerce (Sem 3-6)
- `#phase/3` — Plugin System (Sem 7-10)
- `#phase/4` — B2B + AI-Native (Sem 11-16)
- `#phase/5` — Hardening + Beta (Sem 17-20)
- `#phase/6` — Marketplace + v1.0 (Sem 21-24)

<!-- Parent-stack links intentionally omitted in the public repo.
     Developers with a private vault can restore them in .claude/CLAUDE.local.md. -->


## Dataview — Recent ADRs

```dataview
TABLE WITHOUT ID
  file.link AS "ADR",
  status,
  date
FROM "docs/adrs"
WHERE contains(file.name, "ADR-")
SORT date DESC
```

## Dataview — Active Phase

```dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status,
  started
FROM "#phase/1"
WHERE status != "completed"
```
