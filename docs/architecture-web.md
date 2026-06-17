# Architecture — web (Next.js storefront + admin)

> Generated 2026-06-17 (deep scan). Part: `apps/web`. See [apps/web/CLAUDE.md](../apps/web/CLAUDE.md) for authoritative patterns.

## Executive summary

Next.js 15 App Router app (React 19, RSC-first). One app hosts two surfaces: the **public storefront** (SEO-critical, ISR) and the **`/admin` panel** (header-auth, no-index). Data comes from the NestJS API; product JSON is normalized before render.

## Technology stack

| Category | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) | RSC by default; small `"use client"` budget |
| UI | React 19 | |
| Styling | Tailwind CSS + Radix primitives | `cn()` helper (`lib/utils.ts`) |
| Markdown | react-markdown | blog rendering inside `prose` |
| Data | server fetch `lib/api.ts` (`API_BASE_URL`, `cache: no-store`) | freshness via page-level `export const revalidate` (ISR) |

## Surfaces

- **Public** (`page.tsx`, `categories/[slug]`, `blog`, `khuyen-mai`, `deal-hot`, `ai/[slug]`, `r/[shareSlug]`, static pages): ISR-enabled (`revalidate: 300` on niche/product), indexable, emits JSON-LD + sitemap.
- **Admin** (`app/admin/*`): header-auth, blocked in `robots.ts`, no caching. Pages: Refinery (`/admin`), articles, campaigns, coupons, niches, products, shops, tools, analytics (War Room), crawler-logs.

## Architecture patterns

- **RSC-first**: data fetching + JSON-LD emission on the server. Client components only for interactivity (admin editors, quiz flow).
- **Server actions, two audiences:**
  - `app/actions/tracking.ts` — `createTrackingRedirect()`: the only storefront↔api click contract. Generates 32-char dashless uuid, POSTs `/tracking/click`, appends `?utm_source=`, `redirect()`s. **Do not refactor the token shape.**
  - `app/admin/actions.ts` — `adminFetch` / `post()` inject `x-admin-role` + `x-admin-key`; every action ends with `revalidatePath(...)`.
- **Single safe read of `scrapedData`**: `lib/format.ts → normalizeProduct()` → `ProductView`. UI consumes `ProductView`, never raw JSON.
- **Routing/SEO continuity**: niche pages live at `/categories/[slug]` (entity is `Niche`); legacy `/tools/...` 308-redirect to `/categories/...` (in `next.config.ts`).

## Key routes

| Route | Purpose |
|---|---|
| `/` | Homepage: hero, niche grid, top-products |
| `/categories/[slug]` · `/[productSlug]` | Niche page · product detail (JSON-LD) |
| `/blog` · `/blog/[slug]` | Blog list (filters `?type`, `?category`) · detail |
| `/khuyen-mai/[merchantSlug]` | Coupon hub |
| `/deal-hot` · `/deal-hot/[date]` | Deal-hot landing |
| `/ai/[slug]` → `/quiz` → `/result/[sessionId]` | Interactive AI tool flow |
| `/r/[shareSlug]` | Shareable result |
| `/admin/*` | Operator panel (header-auth) |

## SEO surface (load-bearing — touch carefully)

`layout.tsx` (base metadata/OG), `sitemap.ts` (DB-driven), `robots.ts` (blocks `/admin`), per-product `generateMetadata` + JSON-LD `Product`/`Offer`/`AggregateRating`, blog `Article` JSON-LD. ISR 300s. `SITE_URL` required in prod.

## Testing

No test suite; `lint` (`npm run lint:web`) + `build` are the integration checks. Component inventory: component-inventory-web.md _(To be generated)_.

## Integration

Talks to the api over HTTP via `lib/api.ts` / server actions. See [integration-architecture.md](./integration-architecture.md).
