# Build context: monorepo root
# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# Build shared package first (produces packages/shared/dist used by backend)
WORKDIR /app/packages/shared
RUN npm run build

# Build backend
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
# prisma generate outputs engine binaries to the *monorepo root* node_modules/.prisma
# (schema.prisma output = "../../node_modules/@prisma/client" relative to apps/backend)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# @janna/shared: node_modules/@janna/shared is a workspace symlink → ../packages/shared
# Node.js needs package.json there to find the "main" entry (dist/index.js).
# Without package.json the module resolution fails even though dist/ exists.
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY apps/backend/package.json ./

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeapp && \
    chown -R nodeapp:nodejs /app

USER nodeapp
EXPOSE 3001
# Extra start-period to allow bootstrap to fetch secrets before /health responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD \
  wget -qO- http://localhost:3001/health || exit 1
# bootstrap.js fetches DB + app secrets from Secrets Manager then requires index.js
CMD ["node", "dist/bootstrap.js"]
