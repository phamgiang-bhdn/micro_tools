# syntax=docker/dockerfile:1.6
#
# Build từ thư mục gốc repo:
#   docker build -f apps/web/Dockerfile -t dealvault-web .

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspaces --include-workspace-root

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/web
RUN npm run build

# ---------- runtime (standalone output) ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Standalone build có sẵn server.js + node_modules tối thiểu.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3100
CMD ["node", "apps/web/server.js"]
