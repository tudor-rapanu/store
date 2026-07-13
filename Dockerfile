# 1. Base stage
FROM node:26.5.0-alpine AS base
WORKDIR /app
# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
#RUN npm install -g npm@12.0.1
RUN --mount=type=cache,target=/root/.npm npm ci

# 2. Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build Next.js
RUN npm run build

# 3. Production runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

# Start the server using the standalone build
CMD ["node", "server.js"]
