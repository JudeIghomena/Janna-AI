# Build context: monorepo root
# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
# openssl is required by the Prisma query engine on Alpine
RUN apk add --no-cache libc6-compat openssl

# ─── Dependencies (production only) ──────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
# Copy the Prisma schema so we can run `prisma generate`
COPY apps/backend/prisma ./apps/backend/prisma

# 1. Build the shared package (produces packages/shared/dist)
WORKDIR /app/packages/shared
RUN npm run build

# 2. Generate Prisma client using the backend schema.
#    Running from apps/backend so the default schema path (prisma/schema.prisma)
#    resolves correctly. Output goes to /app/node_modules/.prisma and
#    /app/node_modules/@prisma/client (schema output = "../../node_modules/@prisma/client").
WORKDIR /app/apps/backend
RUN npx prisma generate

# 3. Build worker TypeScript
WORKDIR /app/apps/worker
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./dist
# Prisma engine binaries (generated at monorepo root level)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Shared dist is required by the @janna/shared npm-workspace symlink at runtime
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY apps/worker/package.json ./

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workerapp && \
    chown -R workerapp:nodejs /app

USER workerapp
# bootstrap.js fetches DB + app secrets from Secrets Manager then requires index.js
CMD ["node", "dist/bootstrap.js"]
