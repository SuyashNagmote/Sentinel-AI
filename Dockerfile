# ─── Stage 1: Dependencies ───
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ─── Stage 2: Build ───
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: Production ───
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 sentinel
RUN adduser --system --uid 1001 sentinel

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data && chown sentinel:sentinel /app/data

USER sentinel

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV SENTINEL_DB_PATH="/app/data/sentinel.db"

# Use dumb-init to handle PID 1 properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
