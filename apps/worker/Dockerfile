# Build context: monorepo root
# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencies ─────────────────────────────────────────────────────────────
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
WORKDIR /app/apps/worker
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./dist
COPY apps/worker/package.json ./

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workerapp && \
    chown -R workerapp:nodejs /app

USER workerapp
CMD ["node", "dist/index.js"]
