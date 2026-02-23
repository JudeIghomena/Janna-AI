# ============================================================
# Janna AI API - Dockerfile
# Multi-stage build for production
# ============================================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter @janna/api...

# ── Builder ───────────────────────────────────────────────
FROM deps AS builder
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
# Generate Prisma client
RUN pnpm --filter @janna/api exec prisma generate
# Typecheck + build
RUN pnpm --filter @janna/api run build

# ── Production image ──────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @janna/api...

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# Non-root user
RUN addgroup --system janna && adduser --system --ingroup janna janna
USER janna

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["node", "dist/index.js"]
