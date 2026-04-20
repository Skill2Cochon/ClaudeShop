# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# ClaudeShop Storefront — Next.js 16 standalone multi-stage build
# Image produced: claudeshop/storefront:<sha>
# Run from monorepo root:
#   docker build -f apps/storefront/Dockerfile -t claudeshop/storefront:dev .
# -----------------------------------------------------------------------------

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat tini
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc* ./
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages packages
COPY modules modules
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter @claudeshop/contracts build \
 && pnpm --filter @claudeshop/sdk build \
 && pnpm --filter @claudeshop/ui build \
 && pnpm --filter @claudeshop/storefront build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache tini \
 && addgroup -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app

COPY --from=build --chown=app:app /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=app:app /repo/apps/storefront/public ./apps/storefront/public

USER app
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/storefront/server.js"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health >/dev/null || exit 1
