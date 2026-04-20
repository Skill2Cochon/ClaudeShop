---
title: Tag Taxonomy
aliases:
  - Tags
  - Vault Tags
tags:
  - type/meta
  - project/claudeshop
---

# Tag Taxonomy

> [!info] Purpose
> Controlled vocabulary for tags used across the ClaudeShop vault. Any new tag should be added here first so it's discoverable via [[MOC]] and filterable via [[../phases.base]] and [[../risks.base]].

## Namespaces

### `#project/*`
Identifies which project a note belongs to. Only `#project/claudeshop` is used here.

### `#type/*`
The note genre.

| Tag | Meaning |
|---|---|
| `#type/project-context` | CLAUDE.md-style context docs |
| `#type/plan` | Implementation plans |
| `#type/adr` | Architecture Decision Records |
| `#type/moc` | Map of Content (hub notes) |
| `#type/meta` | Vault meta (tags, references, dashboards) |
| `#type/runbook` | Operational runbooks |
| `#type/handbook` | Merchant or developer handbook pages |
| `#type/postmortem` | Incident post-mortems |

### `#phase/*`
Maps a note to a project phase. Used to filter the plan and track progress.

| Tag | Phase | Weeks |
|---|---|---|
| `#phase/1` | Bootstrap | 1-2 |
| `#phase/2` | Core Commerce | 3-6 |
| `#phase/3` | Plugin System | 7-10 |
| `#phase/4` | B2B + AI-Native | 11-16 |
| `#phase/5` | Hardening + Beta | 17-20 |
| `#phase/6` | Marketplace + v1.0 | 21-24 |

### `#risk/*`
Risk register severity (see [[../risks.base]]).

| Tag | Severity | Action |
|---|---|---|
| `#risk/critical` | Critical | Blocks launch, immediate mitigation |
| `#risk/high` | High | Pre-launch blocker, tracked weekly |
| `#risk/medium` | Medium | Monitored, mitigations designed |
| `#risk/low` | Low | Accepted, reviewed per-phase |

### `#module/*`
Plugin modules — one tag per module.

| Tag | Module |
|---|---|
| `#module/payment-stripe` | Stripe payment adapter |
| `#module/payment-mollie` | Mollie payment adapter |
| `#module/shipping-shippo` | Shippo multi-carrier |
| `#module/ai-recommendations` | AI reco engine |
| `#module/analytics-plausible` | Plausible analytics |

### `#adr/*`
ADR status.

| Tag | Status |
|---|---|
| `#adr/proposed` | Draft, under discussion |
| `#adr/accepted` | Approved, in effect |
| `#adr/superseded` | Replaced by a later ADR |
| `#adr/deprecated` | No longer relevant |

### `#decision/*`
Tag any section that encodes a decision worth revisiting later.

| Tag | Meaning |
|---|---|
| `#decision/architecture` | Architecture-level decision |
| `#decision/stack` | Stack / tool choice |
| `#decision/business` | Product / business trade-off |
| `#decision/security` | Security-impacting |

## Status tags

Use on any note with a lifecycle.

- `#status/draft`
- `#status/in-progress`
- `#status/blocked`
- `#status/completed`
- `#status/archived`

## Adding a new tag

> [!warning] Rules
> - Every new tag must be added to this file first.
> - Prefer nested tags (`#namespace/value`) over flat tags.
> - One noun per tag, lowercase, kebab-case.
> - Reuse existing namespaces before inventing new ones.
