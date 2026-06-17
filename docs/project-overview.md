# Project Overview — dealvault (micro_tool)

> Brownfield documentation generated for AI-assisted development (BMAD). Last scanned: 2026-06-17. Scan level: deep.

## Purpose

dealvault is a **Vietnam-market affiliate micro-tool platform**. Revenue comes from tracked outbound clicks to affiliate networks (Accesstrade is the active network); conversions are posted back via webhook and reconciled against the network's order API. Strategy: *"one micro-tool = one niche, deeply comparable"* + an **AI deal-intelligence** layer (real-time price truth + interactive AI tools) as the moat. See [CONTEXT.md](./CONTEXT.md) for business context and product direction.

## Repository classification

- **Type:** monorepo (npm workspaces), 2 parts.
- **Parts:**
  - `apps/api` — **backend** (NestJS 10, Prisma, PostgreSQL 16). Global prefix `/api/v1`.
  - `apps/web` — **web** (Next.js 15 App Router, React 19, RSC). Public storefront + `/admin` panel in one app.
- **Shared root tooling:** `scripts/` (banner CLI helpers), `docker-compose.yml` (Postgres + pgAdmin), root `package.json` delegating to workspaces.

## Tech stack summary

| Category | Technology |
|---|---|
| Backend framework | NestJS 10 (TypeScript 5) |
| ORM / DB | Prisma → PostgreSQL 16 (JSONB-heavy: `scrapedData`, `aiOutput`, `schemaConfig`, `filterRules`, `atRawData`) |
| Backend validation | class-validator + global `ValidationPipe` (public DTOs); zod (admin endpoints) |
| Scheduling | `@nestjs/schedule` cron (crawler, coupon, top-products, reconciliation) |
| Frontend framework | Next.js 15 (App Router, RSC, Server Actions), React 19 |
| Styling | Tailwind CSS + Radix primitives, `cn()` helper |
| AI | Provider-agnostic `AiService` — Google Gemini (default `gemini-2.0-flash`) or OpenAI-compatible (e.g. Deepseek) |
| Affiliate | Accesstrade (active) + Playwright web-scrape fallback |
| Infra | Docker Compose, pgAdmin, cron schedulers |

## Architecture type

- **api:** service/API-centric NestJS. One feature module per concern (crawler, refinery, insights, reconciliation, tool, assistant, prices, articles, article-pipeline, coupons, niches, top-products, tracking, webhooks, subscribers, waitlist). Top-level services: `AiService`, `ScraperService`, `ArticleService`, `SyncStatusService`, `PrismaService`.
- **web:** layered RSC app — public storefront (ISR, SEO-critical) + `/admin` (header-auth, no-index). Data via `lib/api.ts`; product reads normalized through `lib/format.ts → normalizeProduct()`.

## The non-negotiable invariants

1. **`trackingCode`** (32-char dashless uuid) is the revenue join key: click → `ClickLog` → `?utm_source=` → affiliate URL → `ConversionWebhook` → reconciler. Never change the format/round-trip.
2. **HITL gate** for everything reaching the storefront: `ProductExtraction` (Refinery), `Article` (blog), `Coupon`. No auto-publish.
3. **Admin auth** = shared-secret headers `x-admin-role` + `x-admin-key` (`ADMIN_API_KEY` must match across both apps). Roles: `viewer | reviewer | admin`.
4. **Per-niche dynamic schema**: `Niche.schemaConfig` drives extraction; web reads via `normalizeProduct`.

## Detailed docs

See [index.md](./index.md) for the full documentation map.
