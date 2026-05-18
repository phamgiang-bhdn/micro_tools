# apps/web — Next.js 15 frontend

Auto-loaded when working anywhere under `apps/web/`. Root `CLAUDE.md` covers monorepo-level concerns; this file is Next-specific.

## Two surfaces, one app

The public storefront and the `/admin` panel both live in this same Next app and share `lib/`, `components/`. They differ in:
- **Public** (`app/page.tsx`, `app/categories/[slug]/...` — URL path kept for SEO, the entity is `Niche`, `app/sitemap.ts`, `app/robots.ts`) — SEO-critical, ISR-enabled, indexable.
- **Admin** (`app/admin/*`) — header-auth, blocked from indexing in `robots.ts`, no caching.

`robots.ts` blocks `/admin` from crawlers. Don't expose admin data from public RSC routes — even accidentally embedding admin fetches inside a public layout will leak.

## RSC vs client components

Default to React Server Components. The repo's `"use client"` budget is small — currently only the interactive admin pieces (`app/admin/prompt-test-client.tsx`, the Refinery review form). Reach for client components when you need:
- Browser event handlers, refs, or `useState`.
- Third-party libs that touch `window`.

Otherwise stay on the server — that's where data fetching and JSON-LD emission live.

## Server actions

Two locations, by audience:
- **`app/actions/tracking.ts`** — public-facing. The `createTrackingRedirect()` action is the only contract between the storefront's "Xem deal" button and the API's click-logging endpoint. It generates a 32-char uuid (no dashes), `POST`s to `/tracking/click`, then appends `?utm_source=<code>` to the affiliate URL. Don't refactor away the dashless `randomUUID().replace(/-/g, "")` shape — partner systems expect that token format.
- **`app/admin/actions.ts`** — admin-facing. Every action goes through `adminFetch(path, method, body?)` (or its `post()` wrapper) that injects `x-admin-role` + `x-admin-key` headers from env (`ADMIN_ROLE` defaults to `"admin"`, `ADMIN_API_KEY` defaults to `"change-me"`). For non-POST verbs (PUT, DELETE) call `adminFetch` directly. Every admin action ends with one or more `revalidatePath(...)` calls.

When adding a new admin action, reuse `adminFetch` / `post` rather than re-implementing the header injection.

## Data layer

- **`lib/api.ts`** — server-side fetch wrapper to the Nest API. `API_BASE_URL` env, falls back to `http://localhost:4000/api/v1`. Uses `cache: "no-store"` on every call; freshness control happens at the **page level** via Next's `export const revalidate = N` (ISR). Don't add `next: { revalidate }` inside `safeFetch` — the dual control becomes confusing.
- **`lib/format.ts` → `normalizeProduct(product)`** — **the only safe way to read `scrapedData`.** `Product.scrapedData` is Json with a per-niche dynamic schema; the normalizer extracts a stable `ProductView` by trying multiple key aliases (`price | salePrice | currentPrice`, `image | imageUrl | thumbnail`, etc.) and computes `discountPercent` from `originalPrice - price`. UI components consume `ProductView`, not raw JSON. When you add a field with multiple possible source keys, extend `normalizeProduct` rather than special-casing in the component.
- **`lib/types.ts`** — `NicheItem`, `NicheDetail`, `ProductItem` (raw, with `scrapedData: Json`), `ProductView` (normalized, what components render).
- Money formatting goes through `formatMoney(value, currency)` in `lib/format.ts` — uses `Intl.NumberFormat("vi-VN", { currency: "VND" })`. Don't roll your own.

## SEO surface

These are load-bearing for organic traffic. Touch carefully.

- **`app/layout.tsx`** — base metadata, OG, Twitter card.
- **`app/sitemap.ts`** — generated from DB (`fetchNiches` + per-niche product slugs). When you add a new public route pattern, add it here.
- **`app/robots.ts`** — explicitly blocks `/admin`.
- **`app/categories/[slug]/[productSlug]/page.tsx`** — emits `generateMetadata` and JSON-LD `Product` / `Offer` / `AggregateRating` per product. The `SITE_URL` env is required in prod for absolute canonical/OG URLs. URL path keeps `/categories/...` (legacy SEO surface — the entity is now `Niche` in code).
- ISR `revalidate: 300` (5 min) on niche & product pages.
- Legacy `/tools/:slug(/:productSlug)` URLs return 308 permanent redirects to `/categories/...` — defined in `next.config.ts`. Don't remove the redirects.

## Styling

Tailwind + small set of Radix primitives. UI atoms live in `components/ui/` (`badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `empty-state.tsx`). `lib/utils.ts` has the `cn()` helper (`clsx` + `tailwind-merge`). Use `cn()` for conditional classnames — don't import `clsx` directly.

## Routing notes

- Niche page (public URL kept as `/categories/[slug]` for SEO): `/categories/[slug]` → `app/categories/[slug]/page.tsx`.
- Product detail: `/categories/[slug]/[productSlug]/page.tsx`. The dynamic segment is `productSlug` but the route also accepts the product UUID as a fallback — see [`lib/slug.ts`] for the lookup helper.
- Blog list: `/blog` → `app/blog/page.tsx`. Supports `?type=BUYING_GUIDE|REVIEW` and `?category=<slug>` filters (the `category` search-param name is kept as public URL; internally it maps to `nicheSlug`). ISR 300s.
- Blog detail: `/blog/[slug]` → `app/blog/[slug]/page.tsx`. Renders markdown via `react-markdown` inside Tailwind `prose` wrapper. Emits JSON-LD `Article` + `generateMetadata`. Shows related products via `ProductCard` at end (powered by `article.products`).
- Admin preview: `app/admin/preview/[extractionId]/page.tsx` — full-page preview of a pending AI extraction (Refinery), used during review.
- Admin niches: `/admin/niches` (list / detail) — internal admin label is "Niche", but `Danh mục` is kept as user-facing label on the storefront.
- Admin articles: `/admin/articles` (list with status/type filters), `/admin/articles/new` (form → triggers AI generation → redirects to detail), `/admin/articles/[id]` (review/edit with markdown Edit/Preview tabs, Publish/Archive buttons). The editor is the only non-trivial client component: `app/admin/articles/[id]/article-editor-client.tsx`.

## Articles AI authoring (HITL)

Same philosophy as Refinery: AI drafts, human reviews, admin publishes. The DB model is `Article` with status `DRAFT | PUBLISHED | ARCHIVED` and type `BUYING_GUIDE | REVIEW`. Storefront only ever sees `PUBLISHED`. When touching `/admin/articles/*`, preserve this gate — no auto-publish.

## Env (this workspace's `.env`)

- `PORT` — defaults to 3100.
- `API_BASE_URL` — required, points to Nest API (e.g. `http://localhost:4000/api/v1`).
- `ADMIN_ROLE` — `viewer | reviewer | admin`.
- `ADMIN_API_KEY` — must match the api workspace's value.
- `SITE_URL` — required in production for sitemap, canonical, OG.

## No test suite here

`lint` is the only check. Build is the integration test in practice — run `npm run build --workspace web` before claiming a change is done.
