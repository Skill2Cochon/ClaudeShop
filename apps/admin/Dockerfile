# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# ClaudeShop Admin — Next.js 16 standalone multi-stage build
# Image produced: claudeshop/admin:<sha>
# Run from monorepo root:
#   docker build -f apps/admin/Dockerfile -t claudeshop/admin:dev .
# -----------------------------------------------------------------------------

# ---------- Stage 1: base ----------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat tini
WORKDIR /repo

# ---------- Stage 2: deps ----------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc* ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages packages
COPY modules modules
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# ---------- Stage 3: build ---------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# SDK + contracts + ui must compile before the admin app.
RUN pnpm --filter @claudeshop/contracts build \
 && pnpm --filter @claudeshop/core build \
 && pnpm --filter @claudeshop/sdk build \
 && pnpm --filter @claudeshop/ui build \
 && pnpm --filter @claudeshop/admin build

# ---------- Stage 4: runtime -------------------------------------------------
# Next standalone produces a minimal node_modules + server.js under
# `.next/standalone`. Combined with `.next/static` + `public` it's all we ship.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache tini \
 && addgroup -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app

# Standalone server + static + public. The standalone folder already contains a
# trimmed node_modules — no pnpm install needed at runtime.
COPY --from=build --chown=app:app /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=app:app /repo/apps/admin/public ./apps/admin/public

USER app
EXPOSE 3002

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/admin/server.js"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3002/api/health >/dev/null || exit 1
