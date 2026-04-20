#!/usr/bin/env bash
# =============================================================================
# ClaudeShop — one-line installer
# -----------------------------------------------------------------------------
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Skill2Cochon/ClaudeShop/main/install.sh | bash
#   # or after cloning:
#   ./install.sh [local|vps|coolify]
#
# Default mode is `local`. The script is idempotent and safe to re-run.
# =============================================================================
set -euo pipefail

MODE="${1:-local}"
REPO_URL="https://github.com/Skill2Cochon/ClaudeShop.git"
CLONE_DIR="${CLAUDESHOP_DIR:-claudeshop}"

# ---------- pretty logging ---------------------------------------------------
c_reset=$'\033[0m'; c_blue=$'\033[1;34m'; c_green=$'\033[1;32m'
c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'
log()  { printf '%s[install]%s %s\n'  "$c_blue"   "$c_reset" "$*"; }
ok()   { printf '%s[ ok  ]%s %s\n'    "$c_green"  "$c_reset" "$*"; }
warn() { printf '%s[warn ]%s %s\n'    "$c_yellow" "$c_reset" "$*" >&2; }
fail() { printf '%s[fail ]%s %s\n'    "$c_red"    "$c_reset" "$*" >&2; exit 1; }

# ---------- 1. Pre-flight ----------------------------------------------------
log "Pre-flight checks for mode=${MODE}"

command -v git    >/dev/null || fail "git not found — install git first (https://git-scm.com)"
command -v docker >/dev/null || fail "docker not found — install Docker Desktop (https://docker.com)"

NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
if [ -z "${NODE_MAJOR:-}" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node 22+ required — install from https://nodejs.org (current: $(node -v 2>/dev/null || echo 'none'))"
fi

if ! command -v pnpm >/dev/null; then
  warn "pnpm not found — installing via corepack"
  corepack enable >/dev/null 2>&1 || fail "corepack enable failed — install pnpm manually: npm i -g pnpm@10"
  corepack prepare pnpm@10.33.0 --activate
fi
ok "Toolchain ready (node $(node -v) · pnpm $(pnpm -v) · docker $(docker --version | awk '{print $3}' | tr -d ,))"

# ---------- 2. Clone or reuse existing tree ---------------------------------
if [ -d "$CLONE_DIR/.git" ]; then
  log "Existing clone at $CLONE_DIR — pulling latest main"
  git -C "$CLONE_DIR" fetch origin main
  git -C "$CLONE_DIR" checkout main
  git -C "$CLONE_DIR" pull --ff-only origin main || warn "Fast-forward failed — local changes?"
else
  log "Cloning $REPO_URL into $CLONE_DIR"
  git clone "$REPO_URL" "$CLONE_DIR"
fi
cd "$CLONE_DIR"
ok "Repo ready at $(pwd)"

# ---------- 3. Install deps --------------------------------------------------
log "Installing workspace dependencies (pnpm install)"
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ---------- 4. Seed env + bootstrap per mode ---------------------------------
case "$MODE" in
  local)
    [ -f .env ] || { log "Copying .env.example → .env"; cp .env.example .env; }
    log "Running local bootstrap (scripts/bootstrap-demo.sh local)"
    ./scripts/bootstrap-demo.sh local
    ok "Local bootstrap complete"
    cat <<EOF

${c_green}✔ ClaudeShop is installed.${c_reset}

  Storefront : http://localhost:3000
  Admin      : http://localhost:3002  (demo@claudeshop.local / demo-admin-1234)
  API        : http://localhost:3001
  API docs   : http://localhost:3001/docs

  Next step  : run ${c_blue}pnpm dev${c_reset} to start the app servers.

EOF
    ;;

  vps|docker)
    [ -f .env.production ] || {
      warn ".env.production missing — copying template. Fill real secrets before you proceed."
      cp .env.production.example .env.production
      fail "Edit .env.production, then re-run: ./install.sh vps"
    }
    log "Building production images"
    docker compose -f docker-compose.prod.yml --env-file .env.production build
    log "Starting stack"
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    log "Applying migrations + optional demo seed"
    ./scripts/bootstrap-demo.sh production
    ok "Production stack up — wire TLS via your reverse proxy (see docs/handbook/deployment.md)"
    ;;

  coolify)
    cat <<EOF

${c_blue}Coolify install${c_reset}

  1. In Coolify, create a new Docker-Compose resource pointing at:
     $REPO_URL
  2. Attach .coolify/stack.yaml as the typed manifest.
  3. Paste every entry from .env.production.example into the Coolify secret manager.
  4. Set DNS A-records for: shop.*, admin.*, api.* → your Coolify host.
  5. Hit Deploy — Coolify builds from main and runs migrate:deploy on first boot.

  Full walk-through: docs/handbook/deployment.md § 3 · Path A

EOF
    ok "Coolify bootstrap instructions printed above"
    ;;

  *)
    fail "Unknown mode '${MODE}' — use: local | vps | coolify"
    ;;
esac

# ---------- 5. Next steps ----------------------------------------------------
cat <<EOF

${c_blue}Further reading:${c_reset}
  · ${c_green}CLAUDE.md${c_reset}                              — project context + rules
  · ${c_green}docs/handbook/getting-started.md${c_reset}       — operator guide
  · ${c_green}docs/handbook/configuration.md${c_reset}         — env-var glossary + multi-tenant
  · ${c_green}docs/handbook/deployment.md${c_reset}            — full deploy guide
  · ${c_green}AUDIT.md${c_reset}                               — pre-prod security checklist
  · ${c_green}.claude/install.md${c_reset}                     — Claude install playbook

If you invoke Claude Code from this repo, it auto-registers the bundled plugin.
In Claude Code:  /plugin install claudeshop-install@claudeshop

EOF
