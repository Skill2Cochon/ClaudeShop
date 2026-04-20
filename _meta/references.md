---
title: External References
aliases:
  - References
  - Reference Implementations
tags:
  - type/meta
  - project/claudeshop
status: active
---

# External References

> [!info] Purpose
> Index of external codebases we study to benchmark ClaudeShop — what to copy, adapt, invent, and avoid. See the plan's [[../.claude/plan/claudeshop-v1-0#Adoption Matrix|Adoption Matrix]].

## Reference repos to study

> [!note] Convention
> Clone these repos **outside the ClaudeShop tree** (`--depth 1` shallow) so the vault stays lean and you avoid git-in-git. A convenient path is a sibling folder, e.g. `../references/`.

### Commerce platforms (benchmark for CMS / ERP / CRM surfaces)

| Project | Repo | Study |
|---|---|---|
| **PrestaShop** (incumbent to replace) | `PrestaShop/PrestaShop` (`develop`) | Hook system, module lifecycle, legacy schema edge cases, i18n |
| **Medusa v2** | `medusajs/medusa` | Module structure, core-flows, REST contract style |
| **Saleor** | `saleor/saleor` | App manifest mount points, webhook dispatch, GraphQL stitching |
| **Vendure** | `vendure-ecommerce/vendure` | `@VendurePlugin` decorator, typed event bus, admin-ui extension pattern |
| **Shopify Hydrogen** | `Shopify/hydrogen` | Cart mutation primitives, customer account API, storefront skeleton |

### AI agent platforms (benchmark for Agents + Skills surface, Phase 4)

| Project | Repo | Study |
|---|---|---|
| **Hermes Agent** (Nous Research, MIT) | `nousresearch/hermes-agent` | Self-improving agent pattern, skill creation from experience, MCP server layout, cross-session memory architecture |
| **Claude Agent SDK (TypeScript)** | `anthropics/claude-agent-sdk-typescript` | Programmatic Claude Code harness: tools, hooks, sub-agents, context-usage API |
| **claude-mem** | `thedotmack/claude-mem` | PostToolUse observation capture + vector recall pattern (ships as MCP plugin in this repo) |
| **MemPalace** | `MemPalace/mempalace` | L0/L1/L2/L3 palace memory for multi-hour Claude sessions |
| **Graphify** | `safishamsi/graphify` | Folder → knowledge graph + Obsidian vault generator, ~71× token reduction in long sessions |

## Cloning strategy

> [!tip] Shallow clones only
> All reference repos should be cloned with `--depth 1` to save disk + bandwidth. We don't need history — we study surface code.

```bash
# Suggested layout: a sibling `references/` folder next to your ClaudeShop clone.
mkdir -p ../references
cd ../references

git clone --depth 1 --branch develop https://github.com/PrestaShop/PrestaShop.git prestashop
git clone --depth 1 https://github.com/medusajs/medusa.git medusa
git clone --depth 1 https://github.com/saleor/saleor.git saleor
git clone --depth 1 https://github.com/vendure-ecommerce/vendure.git vendure
git clone --depth 1 https://github.com/Shopify/hydrogen.git hydrogen
```

## Indexing via GitNexus

GitNexus builds a code knowledge graph queryable via MCP tools:

```bash
cd ../references/prestashop
npx gitnexus analyze --embeddings
```

Produces a semantic index queryable via the `gitnexus-exploring` skill — useful when asking "how does PrestaShop handle cart persistence?" during Phase 2+ work.

## What to study per repo

### PrestaShop (9.x)

> [!note] Priority
> **Highest** — this is the incumbent we replace. Understand what merchants love and hate.

- `classes/Hook.php` — hook system (reveals 500+ hook points)
- `src/Adapter/` — Symfony adapter wrappers (hint at module boundaries)
- `src/Core/Module/` — module lifecycle
- `src/PrestaShopBundle/Controller/Admin/` — admin UI patterns (what we modernise)
- `install/data/db_structure.sql` — full legacy schema (lots of VAT/promo edge cases)
- `src/Core/Localization/` — i18n approach
- `modules/` (official modules) — examples of module contracts
- Grep for `Hook::exec` to understand extension points

### Medusa v2

- `packages/medusa/src/api/` — REST contract style
- `packages/modules/` — module per-domain structure
- `packages/modules/stock-location/` — example of a self-contained module
- `packages/core-flows/src/` — workflow primitives

### Saleor

- `saleor/app/manifest.py` — App manifest (mount points)
- `saleor/webhook/` — webhook dispatch
- `saleor/graphql/` — schema-stitching approach
- `saleor/product/` — variant + attribute model (to adapt)

### Vendure

- `packages/core/src/plugin/` — `@VendurePlugin` decorator impl
- `packages/admin-ui/` — Angular extension pattern
- `packages/core/src/event-bus/` — typed event bus (our inspiration)
- `packages/core/src/entity/` — entity structure

### Hydrogen

- `packages/hydrogen/src/cart/` — cart mutation primitives
- `packages/hydrogen/src/customer/` — customer account API
- `templates/skeleton/` — reference storefront layout

## Derived notes

Once indexed, create one note per insight inside `docs/handbook/reference-insights/` with wikilinks to:

- The source file path on disk (`file:///...`)
- The ClaudeShop equivalent in our repo (`[[../apps/api/...]]`)
- The [[../.claude/plan/claudeshop-v1-0|plan]] section it informs

## Related

- [[MOC|Vault MOC]]
- [[tags|Tag Taxonomy]]
- [[../.claude/plan/claudeshop-v1-0#Adoption Matrix|Plan § Adoption Matrix]]
