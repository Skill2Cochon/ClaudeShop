# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# ClaudeShop API — multi-stage build
# Image produced: claudeshop/api:<sha>
# Run from monorepo root:
#   docker build -f apps/api/Dockerfile -t claudeshop/api:dev .
# -----------------------------------------------------------------------------

# ---------- Stage 1: base ----------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# OpenSSL is required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl libc6-compat tini
WORKDIR /repo

# ---------- Stage 2: deps ----------------------------------------------------
# Install workspace deps with the cache layer — fail fast if lockfile drifts.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc* ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
# modules/ is part of the workspace — copy manifests only for cache efficiency.
COPY modules modules
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# ---------- Stage 3: build ---------------------------------------------------
FROM deps AS build
ENV NODE_ENV=development
COPY . .
# Generate Prisma client for the runtime + compile the api bundle.
RUN pnpm --filter @claudeshop/db generate \
 && pnpm --filter @claudeshop/api build

# ---------- Stage 4: runtime -------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001
WORKDIR /app

# Copy the minimal surface: compiled api + db adapter + prisma client + manifests.
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/modules ./modules
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/pnpm-lock.yaml ./pnpm-lock.yaml

# Non-root runtime user.
RUN addgroup -g 10001 app && adduser -S -u 10001 -G app app \
 && chown -R app:app /app
USER app

EXPOSE 3001

# tini as PID 1 — reaps zombies, forwards signals.
ENTRYPOINT ["/sbin/tini", "--"]

# Apply any pending migrations before the server listens. Safe to run on every
# boot: Prisma only applies pending migrations. DIRECT_URL should bypass
# PgBouncer so `migrate deploy` gets an unpooled connection.
CMD ["sh", "-c", "pnpm --filter @claudeshop/db migrate:deploy && node --enable-source-maps apps/api/dist/server.js"]

# Optional worker mode — same image, different CMD. Override in compose:
#   command: ["sh", "-c", "node --enable-source-maps apps/api/dist/worker.js"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3001/health >/dev/null || exit 1
