# ── Stage 1: Build ─────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Vite reads VITE_* env vars at build time
ARG VITE_MSAL_CLIENT_ID
ARG VITE_MSAL_AUTHORITY

RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
