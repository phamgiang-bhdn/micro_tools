# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business context

dealvault is an affiliate micro-tool platform for the Vietnam market — revenue comes from tracked clicks that convert via affiliate networks. The strategy is "one micro-tool = one niche, deeply comparable" rather than a general catalog. v1 ships with two tools only: `robot-hut-bui-lau-nha` and `may-loc-khong-khi`.

**Read [`docs/CONTEXT.md`](docs/CONTEXT.md) before working on:** anything user-facing on the storefront, the `/admin` panel (Refinery / Prompt Studio / Money Trail / War Room), the AI extraction pipeline, SEO surface, or anything involving the affiliate webhook contract. For infra/build/devops tasks, this file alone is enough.

## Workspace layout

npm workspaces monorepo. Two apps:

- [`apps/api`](apps/api/CLAUDE.md) — NestJS 10 backend, Prisma ORM on PostgreSQL 16. Global prefix `/api/v1`. **See [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) for backend-specific patterns** (auto-loaded when working in that directory).
- [`apps/web`](apps/web/CLAUDE.md) — Next.js 15 (App Router, React 19, RSC). Public storefront + `/admin` panel in the same app. **See [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) for frontend-specific patterns** (auto-loaded when working in that directory).

Top-level scripts delegate to workspaces via `npm run <x> --workspace api|web`. Banner-coloured CLI helpers live in `scripts/`.

## Commands

Dev:
- `npm run dev:api` — Nest watch mode, port 4000.
- `npm run dev:web` — Next dev, port 3100.
- `npm run bootstrap` — first-time setup: copy `.env`, `docker compose up -d` (Postgres + pgAdmin), `prisma migrate deploy`, seed.
- `npm run setup` — same as bootstrap minus env init.
- `npm run docker:up` / `docker:down`.

Database:
- `npm run db:deploy` — apply migrations (safe, no prompts). Use after `git pull`.
- `npm run db:seed` — `node apps/api/prisma/seed.js`.
- `npm run db:generate` — regenerate Prisma client after editing `schema.prisma`.
- `npm run prisma:migrate --workspace api` — create + apply a new dev migration (interactive).
- `npm run prisma:studio --workspace api` — GUI on the DB.

Build / lint / test:
- `npm run build` — builds web then api.
- `npm run lint:web`.
- `npm run test:api` — Jest. Single test: `npm run test --workspace api -- <pattern>` or `-- -t "name"`.

Ports: web `3100`, api `4000`, pgAdmin `5050`.

## Cross-app invariants

These bind the two apps together — changing one side requires understanding the other.

**`trackingCode` is the cross-table join key for revenue attribution.** Click flow: web server action `createTrackingRedirect()` generates a 32-char dashless uuid → `POST /api/v1/tracking/click` creates `ClickLog` → web appends `?utm_source=<trackingCode>` and `redirect()`s to the affiliate URL. Later the affiliate network posts to `/api/v1/webhooks/conversion` with that same code → `ConversionWebhook` rows reference `ClickLog` by `trackingCode`. **Don't change the token format or the round-trip contract** — every revenue attribution depends on it.

**Admin auth is shared-secret header, not session.** Both apps read `ADMIN_API_KEY` from their own `.env` — **the values must match**. The web app's admin server actions inject `x-admin-role` + `x-admin-key`; the api's `AdminController` validates them per-method via `this.authorize(role, apiKey, allowedRoles)`. Roles: `viewer | reviewer | admin`.

**The HITL gate is sacred — both for product data and for blog content.** Two parallel pipelines use the same philosophy:
- `ProductExtraction`: `DRAFT_RAW | PENDING_REVIEW | PUBLISHED | ERROR` — admin approves in `/admin/refinery` to unlock `Product.scrapedData` on the storefront.
- `Article`: `DRAFT | PUBLISHED | ARCHIVED` — admin approves in `/admin/articles/[id]` to publish a blog post.

Nothing reaches the public storefront in either pipeline until a human reviews. See `docs/CONTEXT.md` for *why* this is non-negotiable.

**Schema is per-tool dynamic.** `Tool.schemaConfig` (Json) defines what fields each micro-tool extracts. The api's AI extractor must match it; the web side reads via `apps/web/lib/format.ts → normalizeProduct()`. Don't bypass `normalizeProduct` on the web side, and don't hard-code field names on the api side.

## Conventions

- TypeScript strict; no `any`.
- After editing `apps/api/prisma/schema.prisma`, run `npm run db:generate` before relying on the new types.
- Seed file is `apps/api/prisma/seed.js` (JS, not TS) — currently focuses on the v1 launch lineup (`robot-hut-bui-lau-nha`, `may-loc-khong-khi`). Don't reintroduce the older 5-tool seed.

## Env files

Two separate `.env` files: `apps/api/.env` and `apps/web/.env`. Both have `.env.example` siblings; `npm run env:init` copies them if missing. `ADMIN_API_KEY` must match across both. `.env` is gitignored. Per-app env details are in each app's `CLAUDE.md`.
