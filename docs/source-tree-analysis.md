# Source Tree Analysis

> Generated 2026-06-17 (deep scan). Annotated tree of critical directories.

```
micro_tools/
├── apps/
│   ├── api/                              # Part: api — NestJS backend (port 4000, prefix /api/v1)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # Single source of truth for the data model
│   │   │   ├── migrations/0_init/        # Single squashed baseline (pre-release)
│   │   │   └── seed.js                   # ~100 niches (1 launch-active) + PromptTemplates + sample Tool + authors
│   │   └── src/
│   │       ├── main.ts                   # bootstrap: setGlobalPrefix("api/v1"), global ValidationPipe
│   │       ├── prisma/                   # PrismaService singleton (inject everywhere)
│   │       ├── services/                 # AiService, ScraperService, ArticleService, SyncStatusService
│   │       └── modules/
│   │           ├── app.module.ts         # Root wiring
│   │           ├── admin/                # AdminController — Refinery/Prompt Studio/Money Trail/War Room (per-method authorize)
│   │           ├── crawler/              # AT clients, CampaignSync, CouponSync, TopProductsSync, Import,
│   │           │                         #   Enrichment, Classification, PriceIntelligence, ProductDiscovery
│   │           ├── refinery/             # ConfidenceService (deterministic score) + RefineryService (bulk approve)
│   │           ├── insights/             # Money loops: CommissionRank, KeywordRadar, OrderProductsSync, RealBestseller, MoneyTrail
│   │           ├── reconciliation/       # /v1/order-list ground-truth poller
│   │           ├── tool/                 # Interactive AI tool: ScoringService + ToolAiService + InventoryCheck + ToolPublicController
│   │           ├── assistant/            # AI price/classification assistant (V4)
│   │           ├── prices/               # PriceSnapshot read API (price history / intelligence)
│   │           ├── articles/             # Public GET /articles (+ notification service)
│   │           ├── article-pipeline/     # Multi-stage AI article generation + refresh
│   │           ├── coupons/              # Public GET /coupons
│   │           ├── niches/               # Public GET /niches
│   │           ├── top-products/         # Public GET /top-products
│   │           ├── subscribers/          # Subscriber capture
│   │           ├── waitlist/             # Waitlist signup
│   │           ├── tracking/             # POST /tracking/click → ClickLog
│   │           └── webhooks/             # POST /webhooks/accesstrade → ConversionWebhook
│   │
│   └── web/                              # Part: web — Next.js 15 storefront + admin (port 3100)
│       ├── app/
│       │   ├── page.tsx                  # Homepage (hero, niche grid, top-products)
│       │   ├── layout.tsx · sitemap.ts · robots.ts   # SEO surface (load-bearing)
│       │   ├── categories/[slug]/        # Niche page (URL kept /categories for SEO; entity = Niche)
│       │   │   └── [productSlug]/        # Product detail + JSON-LD Product/Offer/AggregateRating
│       │   ├── blog/ · blog/[slug]/      # Blog list + detail (JSON-LD Article)
│       │   ├── khuyen-mai/[merchantSlug]/# Coupon hub per merchant
│       │   ├── deal-hot/ · deal-hot/[date]/  # Deal-hot landing
│       │   ├── ai/[slug]/                # Interactive AI tool: landing → quiz → result/[sessionId]
│       │   ├── r/[shareSlug]/            # Shareable result link
│       │   ├── coming-soon/[slug]/       # Pre-launch niche placeholder
│       │   ├── (static)                  # ve-chung-toi, lien-he, dieu-khoan, chinh-sach-bao-mat, tuyen-bo-affiliate
│       │   ├── actions/tracking.ts       # createTrackingRedirect() — DO NOT REFACTOR token shape
│       │   ├── api/                      # Route handlers (proxy / streaming)
│       │   └── admin/                    # Refinery, articles, campaigns, coupons, niches, products, shops, tools, analytics, crawler-logs
│       │       └── actions.ts            # adminFetch + post() — injects x-admin-role / x-admin-key
│       ├── components/                   # hero, product-card, navbar, ui/ (Radix atoms)
│       └── lib/
│           ├── api.ts                    # Server fetch wrapper (cache: no-store; ISR at page level)
│           ├── format.ts                 # formatMoney + normalizeProduct (ONLY safe read of scrapedData)
│           ├── admin/constants.ts        # Centralized magic strings
│           └── types.ts                  # NicheItem, ProductItem, ProductView
│
├── docs/                                 # Project knowledge (this folder) — BMAD reads from here
├── _bmad/ · _bmad-output/                # BMAD-METHOD install + generated artifacts
├── scripts/                              # Banner CLI helpers (dev.mjs, setup.mjs, kill-port.mjs, ...)
├── docker-compose.yml                    # Postgres 16 + pgAdmin
└── package.json                          # npm workspaces root
```

## Entry points

- **api:** `apps/api/src/main.ts` → `AppModule`. Every controller mounted under `/api/v1`.
- **web:** `apps/web/app/layout.tsx` (root layout) + `app/page.tsx`. Server actions in `app/actions/` (public) and `app/admin/actions.ts` (admin).
- **Cross-part interface:** web → api over HTTP (`API_BASE_URL`), and api ← affiliate-network webhooks. See [integration-architecture.md](./integration-architecture.md).
