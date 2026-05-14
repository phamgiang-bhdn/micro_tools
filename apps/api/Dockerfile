# syntax=docker/dockerfile:1.6
#
# Build từ thư mục gốc repo:
#   docker build -f apps/api/Dockerfile -t dealvault-api .

# ---------- deps ----------
FROM node:20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspaces --include-workspace-root

# ---------- build ----------
FROM node:20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
# Playwright base image vì ScraperService dùng Chromium headless.
FROM mcr.microsoft.com/playwright:v1.50.1-jammy AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# Workspace shared deps
COPY --from=build /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# App
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000

# Apply migration trước khi serve. Nếu migrate fail container exit để Docker restart.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
