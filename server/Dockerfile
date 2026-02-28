# ── Stage 1: Build ─────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ── Stage 2: Runtime ────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /data/images && chown -R appuser:appgroup /data

USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
