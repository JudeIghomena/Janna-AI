FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS development
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workerapp && \
    chown -R workerapp:nodejs /app
USER workerapp
CMD ["node", "dist/index.js"]
