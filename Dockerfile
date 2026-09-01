# syntax=docker/dockerfile:1.7
# Production-shaped image for dashchecker-api, task-consumer, and bounded jobs.
# - Immutable pnpm workspace build with frozen lockfile
# - Prisma client generated at build time
# - Single image contains dist/main.js, dist/task-main.js, and dist/job-main.js
# - No .env files or secrets are baked into the image
# - Pinned Node major matches repository engines.node >=20
# - Verification: build locally, run `node dist/main.js`, `node dist/task-main.js`, `node dist/job-main.js`

ARG NODE_VERSION=20.19.0
FROM node:${NODE_VERSION}-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Prisma's config is evaluated during `prisma generate` and requires a
# datasource URL even though generation does not connect to a database. This
# is a synthetic, non-secret builder-only value; runtime uses Secret Manager.
ENV DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

WORKDIR /app

# Copy workspace manifests first for layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

# Copy workspace config needed for install (prisma is devDependency of api)
COPY packages ./packages

# Install with frozen lockfile; no secrets are required at install time.
RUN pnpm install --frozen-lockfile

# Copy remaining source. .dockerignore excludes .env, node_modules, dist, .git, etc.
COPY . .

# Generate Prisma client and build only the API (which also emits task-main and job-main)
RUN pnpm --filter @dashchecker/api db:generate
RUN pnpm --filter @dashchecker/api build

# Verify built entrypoints are syntactically valid
RUN node --check apps/api/dist/main.js && node --check apps/api/dist/task-main.js && node --check apps/api/dist/job-main.js

FROM node:${NODE_VERSION}-alpine AS runtime

# Run as non-root (node user exists in official image)
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

ENV NODE_ENV=production
# Cloud Run injects PORT; default keeps local `docker run` usable.
ENV PORT=3000

# Copy production node_modules and built artifacts only.
# pnpm workspace uses a content-addressable store at /app/node_modules/.pnpm and per-package symlinks.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/packages ./packages

# Ensure the working directory for `node dist/*.js` matches the compiled output.
# dist is at /app/apps/api/dist, so we normalize entrypoint paths.
WORKDIR /app/apps/api

# Default is the public API; other entrypoints are documented below.
# Public API:          node dist/main.js
# Task consumer:       node dist/task-main.js
# Bounded job:         node dist/job-main.js  (requires JOB_NAME env)
# All job commands require: WORKER_ENABLED=true WORKER_EXECUTION=run-once
USER app
EXPOSE 3000

# Health and readiness are at GET /health/live and GET /health/ready
CMD ["node", "dist/main.js"]
