# Development Guide

> Generated 2026-06-17. Local setup, build, and conventions. See root [README.md](../README.md) for the long-form version and troubleshooting.

## Prerequisites

- Node.js ≥ 20
- Docker Desktop (Postgres 16 + pgAdmin via `docker-compose.yml`)
- Gemini API key (only for AI paths) · Accesstrade access token (only for real crawl)

## First-time setup

```bash
npm install
npm run bootstrap   # env:init + docker up + db:deploy + seed
```

`ADMIN_API_KEY` must match across `apps/api/.env` and `apps/web/.env`.

## Run

```bash
npm run dev          # api (4000) + web (3100) in parallel
npm run dev:api      # backend only
npm run dev:web      # frontend only
npm run kill:all     # free ports 4000 + 3100
```

Ports: web `3100`, api `4000`, pgAdmin `5050`.

## Database

```bash
npm run db:deploy                      # apply migrations + regen client (after git pull)
npm run db:migrate -- --name <slug>    # new dev migration from schema diff
npm run db:reset                       # drop → re-apply baseline → seed (pre-release; never prod)
npm run prisma:studio --workspace api  # GUI
```

Migrations are a **single squashed baseline** (`prisma/migrations/0_init/`). New schema work = edit `schema.prisma` → `db:migrate`. `schema.prisma` is the source of truth.

## Build / lint / test

```bash
npm run build        # web then api
npm run lint:web     # ESLint (web)
npm run test:api     # Jest (single: npm run test --workspace api -- -t "name")
```

## Conventions

- TypeScript strict, no `any`.
- **api:** public endpoints use class-validator DTOs (+ global `ValidationPipe`); admin endpoints use zod + per-method `authorize()`. Inject `PrismaService`. Don't add stage-level retry around AI.
- **web:** RSC by default; `"use client"` only for browser APIs/state/events. Read `scrapedData` only via `normalizeProduct`. Reuse `adminFetch`/`post` for admin actions; end with `revalidatePath`.
- Read the relevant `CLAUDE.md` (root + `apps/api` + `apps/web`) before large pattern work — they hold the binding invariants.
- Before claiming done: `npm run lint:web` + `npm run test:api` + `npm run build`.

## Deployment

Local dev uses Docker Compose for Postgres. No production CI/CD pipeline is committed yet (no `.github/workflows`); deployment configuration is TBD.
