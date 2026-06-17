# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business context

dealvault is an affiliate micro-tool platform for the Vietnam market — revenue comes from tracked clicks that convert via affiliate networks. The strategy is "one micro-tool = one niche, deeply comparable" rather than a general catalog, layered with **AI deal-intelligence** (real-time price truth + interactive AI tools) as the moat. The niche lineup is seeded in [`apps/api/prisma/seed.js`](apps/api/prisma/seed.js) (~100 niches across phones, computing, audio, wearables, camera, smart home, appliances, beauty, health, baby, and more — only the launch niche is `ACTIVE`). **Products are not seeded** — they flow exclusively from the Accesstrade crawler after admins onboard campaigns to a niche.

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
- `npm run db:deploy` — apply pending migrations + regen Prisma Client. Use after `git pull`.
- `npm run db:migrate -- --name <slug>` — create + apply a new dev migration from `schema.prisma` diff (auto-regens client).
- `npm run db:reset` — drop DB → re-apply all migrations → run seed. Pre-release reset; **never run in prod**.
- `npm run prisma:studio --workspace api` — GUI on the DB.
- `npm run prisma:seed --workspace api` — re-run seed only (rare; `db:reset` already seeds).

Build / lint / test:
- `npm run build` — builds web then api.
- `npm run lint:web`.
- `npm run test:api` — Jest. Single test: `npm run test --workspace api -- <pattern>` or `-- -t "name"`.

Ports: web `3100`, api `4000`, pgAdmin `5050`.

## Cross-app invariants

These bind the two apps together — changing one side requires understanding the other.

**`trackingCode` is the cross-table join key for revenue attribution.** Click flow: web server action `createTrackingRedirect()` generates a 32-char dashless uuid → `POST /api/v1/tracking/click` creates `ClickLog` → web appends `?utm_source=<trackingCode>` and `redirect()`s to the affiliate URL. Later the affiliate network posts to `/api/v1/webhooks/conversion` with that same code → `ConversionWebhook` rows reference `ClickLog` by `trackingCode`. **Don't change the token format or the round-trip contract** — every revenue attribution depends on it.

**Admin auth is shared-secret header, not session.** Both apps read `ADMIN_API_KEY` from their own `.env` — **the values must match**. The web app's admin server actions inject `x-admin-role` + `x-admin-key`; the api's `AdminController` validates them per-method via `this.authorize(role, apiKey, allowedRoles)`. Roles: `viewer | reviewer | admin`.

**The HITL gate is sacred — for product data, blog content, and coupons.** Parallel pipelines share the same philosophy:
- `ProductExtraction`: `DRAFT_RAW | PENDING_REVIEW | PUBLISHED | ERROR` — admin approves in `/admin/refinery` to unlock `Product.scrapedData` on the storefront.
- `Article`: `DRAFT | PUBLISHED | ARCHIVED` — admin approves in `/admin/articles/[id]` to publish a blog post.
- `Coupon`: `isActive=false` on sync — admin approves to surface on `/khuyen-mai/<merchant>`.

Nothing reaches the public storefront in any pipeline until a human reviews. See `docs/CONTEXT.md` for *why* this is non-negotiable.

**Schema is per-niche dynamic.** `Niche.schemaConfig` (Json) defines what fields each niche extracts. The api's AI extractor must match it; the web side reads via `apps/web/lib/format.ts → normalizeProduct()`. Don't bypass `normalizeProduct` on the web side, and don't hard-code field names on the api side.

**Naming.** The platform is positioned as a "micro-tool platform" in product strategy (see `docs/CONTEXT.md`). The entity that groups products is `Niche` (slug + name + dynamic `schemaConfig`). The public storefront URL is `/categories/[slug]` for SEO. `Tool` is a distinct concept — interactive AI quiz/scoring tools (the `Tool` / `QuizSession` models and the Tool module), not the product-grouping entity. Keep these three names distinct: `Niche` (grouping), `Tool` (interactive AI tool), `Campaign` (Accesstrade upstream).

## Conventions

- TypeScript strict; no `any`.
- After editing `apps/api/prisma/schema.prisma`, run `npm run db:migrate -- --name <slug>` (creates a migration, applies it, regens the client) — don't edit the DB by hand.
- Seed file is `apps/api/prisma/seed.js` (JS, not TS) — Niche rows + system `PromptTemplate` rows + sample Tool + default Authors. Does **not** seed Product / ClickLog / ConversionWebhook; those come from the crawler + real user clicks. Only the launch niche is created `ACTIVE`; the rest are `INACTIVE` (data kept, hidden from the storefront).

## Env files

Two separate `.env` files: `apps/api/.env` and `apps/web/.env`. Both have `.env.example` siblings; `npm run env:init` copies them if missing. `ADMIN_API_KEY` must match across both. `.env` is gitignored. Per-app env details are in each app's `CLAUDE.md`.
