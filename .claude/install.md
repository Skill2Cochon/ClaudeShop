---
title: ClaudeShop — Install Playbook (for Claude)
tags:
  - type/playbook
  - project/claudeshop
  - scope/install
status: stable
updated: 2026-04-20
---

# ClaudeShop — Install Playbook (for Claude)

> [!abstract] Purpose
> This file is the **source of truth** when Claude is asked to install / bootstrap / deploy ClaudeShop. The `claudeshop-install` skill loads this note and walks every phase. Follow in order — each phase ends with a checkpoint commit so a session can resume cleanly.

**Parent** :: [[../CLAUDE|CLAUDE.md]]
**Related** :: [[install-manifest.json]] · [[mcp.json]] · [[../docs/handbook/deployment|Handbook § Deployment]] · [[../AUDIT|AUDIT.md]]

## Phase 0 — Pre-flight

> [!important] Ask once if ambiguous, then proceed.
> Required answers: target environment, whether the user already has cloud creds, whether they want a demo seed.

| Check | Command | Fail response |
|---|---|---|
| Git installed | `git --version` | Instruct user to install git |
| Node 22+ | `node -v` | Instruct user to install Node 22 |
| pnpm 10+ | `pnpm -v` (fallback `corepack enable`) | `corepack prepare pnpm@10 --activate` |
| Docker 24+ | `docker --version` | Abort with install link |
| Target env chosen | Ask user: `local` / `vps` / `coolify` | Default `local` if truly ambiguous |
| Disk space | `df -h .` → ≥ 3 GB free | Abort |
| Network | `curl -sI https://registry.npmjs.org` → 200 | Abort + suggest VPN/proxy fix |

Checkpoint : `git commit --allow-empty -m "checkpoint: phase 0 preflight ok"` if operating inside an existing repo.

## Phase 1 — Clone + worktree

```bash
# Fresh clone
git clone https://github.com/Skill2Cochon/ClaudeShop.git claudeshop
cd claudeshop

# Or, if the repo exists elsewhere on disk, use a worktree:
git worktree add ../claudeshop-deploy main
cd ../claudeshop-deploy
```

Always checkout `main` for the first install. The user can switch to a feature branch after.

## Phase 2 — Install toolchain

```bash
pnpm install --frozen-lockfile
pnpm --filter @claudeshop/db generate   # Prisma client
```

If any workspace fails to build, stop and diagnose. Common causes:
- Node < 22 (version mismatch)
- pnpm < 10 (catalog versions unsupported)
- Native build toolchain missing on Alpine (install `libc6-compat`)

## Phase 3 — Bootstrap infrastructure

### Local mode

```bash
[ -f .env ] || cp .env.example .env
./scripts/bootstrap-demo.sh local
pnpm dev
```

Expected URLs :
- Storefront `http://localhost:3000`
- Admin `http://localhost:3002` — login `demo@claudeshop.local / demo-admin-1234`
- API `http://localhost:3001`

### VPS / generic Docker mode

```bash
[ -f .env.production ] || cp .env.production.example .env.production
# !!! STOP. The user must edit .env.production now — do not auto-fill secrets. !!!

docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
./scripts/bootstrap-demo.sh production
```

TLS :: let the user wire Caddy/Traefik/nginx. Do **not** attempt to install a reverse proxy unconfirmed.

### Coolify mode

Do not run any shell commands. Emit the 5-step Coolify walk-through from `docs/handbook/deployment.md § 3 · Path A`. The user runs these from the Coolify UI.

## Phase 4 — Migrations + seed

```bash
pnpm db:migrate       # dev
# or
docker compose exec api pnpm --filter @claudeshop/db migrate:deploy  # prod
```

Seed :
- **local** : `pnpm db:seed` (demo tenant + `demo@claudeshop.local / demo-admin-1234`)
- **prod** : only if user set `SEED_DEMO=true` in `.env.production`. Otherwise propose `pnpm --filter @claudeshop/db create-admin` for a real first admin.

> [!info] Phase 60+ — `db:seed` now writes tenant artefacts automatically.
> After creating the demo tenant, the seed writes three files:
>
> | File | Purpose |
> |---|---|
> | `<repo>/.env.seeded` | Audit trail — full demo metadata (id, slug, admin creds, timestamp) |
> | `<repo>/apps/storefront/.env.local` | Next.js auto-loads it — sets `SEEDED_DEMO_TENANT_ID` + slug |
> | `<repo>/apps/admin/.env.local` | Same, for the admin app |
>
> All three are gitignored. Storefront + admin also address the tenant
> **by slug** (`x-tenant-slug: demo`) when no CUID is set — the API
> resolves it via Prisma + an in-process LRU cache. So even if the
> `.env.local` files are missing, the demo still works.

## Phase 5 — Register MCP servers (for Claude context continuity)

Read `.claude/mcp.json` and prompt the user to append each server entry to their `~/.claude.json` (or project-local equivalent). Never auto-write — show the JSON block and ask for confirmation.

Ordered priority :

1. **gitnexus** — code knowledge graph (blast radius before every edit). Lightweight — adds ~400 tokens once.
2. **claude-mem** — observation capture + vector recall across sessions. ~300 tokens baseline, ~200/query.
3. **basic-memory** — Markdown KB, writes to `./vault/`. Obsidian-compatible.
4. **mempalace** *(optional)* — L0-L3 palace memory for multi-hour deploys. Cheap boot (~170 tokens).
5. **graphify** *(optional, high value)* — folder → knowledge graph, claims 71× token reduction in long sessions. Install via `pip install graphify && graphify install`.

Verify registration :
```bash
claude mcp list   # if using Claude Code CLI
```

## Phase 6 — Post-install verification

Run these in order. Each must pass before handing off.

| # | Check | Command | Pass criteria |
|---|---|---|---|
| 1 | API health | `curl -s http://localhost:3001/health` | `{"status":"ok"}` |
| 2 | Migrations up-to-date | `pnpm --filter @claudeshop/db migrate:status` | `No pending migrations` |
| 3 | Admin login | Visit `http://localhost:3002/login` | 200 + renders form |
| 4 | Storefront home | Visit `http://localhost:3000` | 200 + shows the demo tee |
| 5 | GitNexus index | `npx gitnexus query "claudeshop"` | Returns results |
| 6 | Audit log writable | Create a product via admin | Appears in `/audit` page |

If any step fails, report the error and the suggested fix **without** retrying silently.

## Phase 7 — Hand-off report

> [!note] Template to emit at the end of the install
> Copy this, fill in real values, post it to the user chat.

```
─────────────────────────────────────────────────────
✔ ClaudeShop installed (mode: {local|vps|coolify})

URLs
  Storefront : {url}
  Admin      : {url}
  API        : {url}
  API docs   : {url}/docs

First-login
  Email    : {demo@claudeshop.local or user-provisioned}
  Password : {from seed or user-set}
  → Change it from Settings → Security before anything else.

MCP servers registered : gitnexus · claude-mem · basic-memory · {…optional…}

Pending follow-ups (from AUDIT.md)
  ▢ Add admin auth guard to /v1/admin/* routes (Critical)
  ▢ Wire HTTPS via reverse proxy (required before public traffic)
  ▢ Tighten rate limit on /v1/auth/login (recommended)
  ▢ Pin Docker image tags in docker-compose.prod.yml (recommended)

Next merchant action
  1. Log in to the admin.
  2. Go to Settings → Site — set your store name + logo.
  3. Go to Settings → Payments — paste Stripe test keys.
  4. Go to Products — import a CSV or add your first product.
  5. Place a test order from the storefront to validate the full loop.

Full context : CLAUDE.md · docs/handbook/getting-started.md
─────────────────────────────────────────────────────
```

## Appendix A — Security must-do before public launch

Auto-apply at install time is **not safe** for these — they modify behaviour and need user review. Surface them in the hand-off:

1. Admin auth guard on `/v1/admin/*` routes (CRITICAL — see AUDIT.md).
2. Tighten rate limit on `/v1/auth/login` to 10/min/IP.
3. Pin Docker image tags (`edoburu/pgbouncer`, `minio/mc`) to specific versions.
4. Verify MinIO bucket visibility — the `claudeshop-media` bucket is set to anonymous download. If you store private files, use a separate bucket.
5. Rotate all `REPLACE_WITH_*` placeholders in `.env.production` before first deploy.

## Appendix B — Resuming a failed install

If a phase fails mid-run, the session may have ended. Resume :

```bash
git log --oneline | head -5
# Find the last "checkpoint: phase N" commit. Restart from phase N+1.
```

If a migration half-applied, run :
```bash
pnpm --filter @claudeshop/db migrate:reset --force   # DEV ONLY
# or, in prod, manually rollback via the migration's down script (docs/adrs/ADR-002).
```

## Appendix C — Uninstall

```bash
docker compose -f docker-compose.yml down -v         # local
docker compose -f docker-compose.prod.yml down -v    # prod (destroys volumes)
cd .. && rm -rf claudeshop
# MCP: remove the ClaudeShop entries from ~/.claude.json
```
