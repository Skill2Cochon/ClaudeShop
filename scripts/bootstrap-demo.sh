#!/usr/bin/env bash
# =============================================================================
# ClaudeShop — demo bootstrap
# -----------------------------------------------------------------------------
# Brings up the stack, applies migrations, and seeds the demo tenant.
# Works in two modes:
#   ./scripts/bootstrap-demo.sh local      # uses docker-compose.yml (dev infra)
#   ./scripts/bootstrap-demo.sh production # uses docker-compose.prod.yml
#
# Safe to re-run: the seed is idempotent (upsert).
# =============================================================================
set -euo pipefail

MODE="${1:-local}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[bootstrap]\033[0m %s\n' "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# 0. Pre-flight
# -----------------------------------------------------------------------------
command -v docker >/dev/null || fail "docker not found in PATH"
command -v pnpm   >/dev/null || fail "pnpm not found in PATH (install with: npm i -g pnpm@10)"

case "$MODE" in
  local)
    COMPOSE_FILE="docker-compose.yml"
    ENV_FILE=".env"
    [ -f "$ENV_FILE" ] || {
      log "No .env — copying from .env.example"
      cp .env.example .env
    }
    ;;
  production)
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_FILE=".env.production"
    [ -f "$ENV_FILE" ] || fail "$ENV_FILE missing — copy from .env.production.example and fill real values"
    # Refuse to seed a reachable demo user in production.
    if grep -q '^SEED_DEMO=true' "$ENV_FILE"; then
      fail "SEED_DEMO=true in $ENV_FILE — refusing to bootstrap a reachable demo user in production"
    fi
    ;;
  *)
    fail "Usage: $0 [local|production]"
    ;;
esac

# -----------------------------------------------------------------------------
# 1. Start infra
# -----------------------------------------------------------------------------
log "Starting infra via $COMPOSE_FILE ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

log "Waiting for Postgres healthcheck ..."
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" ps postgres --format '{{.State}}' | grep -q 'healthy'; then
    break
  fi
  sleep 2
done
docker compose -f "$COMPOSE_FILE" ps postgres --format '{{.State}}' | grep -q 'healthy' \
  || fail "Postgres didn't become healthy within 60s"

# -----------------------------------------------------------------------------
# 2. Install deps + generate Prisma client (local only — prod images have this baked)
# -----------------------------------------------------------------------------
if [ "$MODE" = "local" ]; then
  log "Installing workspace deps ..."
  pnpm install --frozen-lockfile
  log "Generating Prisma client ..."
  pnpm db:generate
fi

# -----------------------------------------------------------------------------
# 3. Migrations
# -----------------------------------------------------------------------------
if [ "$MODE" = "local" ]; then
  log "Applying dev migrations ..."
  pnpm db:migrate
else
  log "Applying production migrations via api container ..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
    pnpm --filter @claudeshop/db migrate:deploy
fi

# -----------------------------------------------------------------------------
# 4. Seed demo tenant (skipped in production unless SEED_DEMO=true)
# -----------------------------------------------------------------------------
if [ "$MODE" = "local" ] || grep -q '^SEED_DEMO=true' "$ENV_FILE"; then
  if [ "$MODE" = "local" ]; then
    log "Seeding demo tenant (demo@claudeshop.local / demo-admin-1234) ..."
    pnpm db:seed
  else
    log "Seeding demo tenant via api container ..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
      pnpm --filter @claudeshop/db seed
  fi
else
  warn "SEED_DEMO not enabled in production — skipping demo seed."
  warn "Provision a real admin with: docker compose exec api pnpm --filter @claudeshop/db create-admin -- --email=... --password=..."
fi

# -----------------------------------------------------------------------------
# 5. Summary
# -----------------------------------------------------------------------------
log "---------------------------------------------------------------"
log "  ClaudeShop bootstrap complete ($MODE)"
if [ "$MODE" = "local" ]; then
  log "  Storefront : http://localhost:3000"
  log "  Admin      : http://localhost:3002 (demo@claudeshop.local / demo-admin-1234)"
  log "  API        : http://localhost:3001"
  log "  API docs   : http://localhost:3001/docs"
  log "  Mailhog    : http://localhost:8025"
  log "  MinIO UI   : http://localhost:9001"
  log ""
  log "Run 'pnpm dev' to start the app servers."
else
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  log "  Storefront : https://${DOMAIN_STOREFRONT:-<unset>}"
  log "  Admin      : https://${DOMAIN_ADMIN:-<unset>}"
  log "  API        : https://${DOMAIN_API:-<unset>}"
fi
log "---------------------------------------------------------------"
