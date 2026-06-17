# Project Documentation Index — dealvault

> Primary entry point for AI-assisted development (BMAD). Generated 2026-06-17 (deep scan). Point planning workflows (PRD, architecture, stories) at this file.

## Project Overview

- **Type:** monorepo with 2 parts
- **Primary language:** TypeScript 5
- **Architecture:** NestJS service/API backend + Next.js RSC web (storefront + admin)

## Quick Reference by part

### api (`apps/api`)
- **Type:** backend
- **Tech:** NestJS 10, Prisma, PostgreSQL 16; AI via Gemini/OpenAI-compatible
- **Entry point:** `src/main.ts` → `AppModule` (prefix `/api/v1`)
- **Architecture:** [architecture-api.md](./architecture-api.md)

### web (`apps/web`)
- **Type:** web
- **Tech:** Next.js 15 (App Router, RSC), React 19, Tailwind + Radix
- **Entry point:** `app/layout.tsx` + `app/page.tsx`
- **Architecture:** [architecture-web.md](./architecture-web.md)

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture — api](./architecture-api.md)
- [Architecture — web](./architecture-web.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Data Models](./data-models.md)
- [Integration Architecture](./integration-architecture.md)
- [Development Guide](./development-guide.md)
- [API Contracts](./api-contracts.md) _(To be generated)_ — run a deep-dive on `apps/api/src/modules/**/**.controller.ts`
- [Component Inventory — web](./component-inventory-web.md) _(To be generated)_ — run a deep-dive on `apps/web/components/`

## Existing / Curated Documentation

- [Business Context & Product Direction](./CONTEXT.md) — what dealvault is, AI deal-intelligence positioning, HITL rationale, domain glossary
- [Accesstrade Integration Reference](./integrations/accesstrade.md) — AT endpoints, auth, rate limits, schema mapping, gotchas
- [README](../README.md) — quick start, scripts, env, troubleshooting
- Binding patterns: [root CLAUDE.md](../CLAUDE.md) · [apps/api/CLAUDE.md](../apps/api/CLAUDE.md) · [apps/web/CLAUDE.md](../apps/web/CLAUDE.md)

## Getting Started

1. Read [project-overview.md](./project-overview.md) then the two architecture docs.
2. For data work, start at [data-models.md](./data-models.md) (`schema.prisma` is source of truth).
3. For new features, run the BMAD PRD workflow and provide **this index** as input.
   - UI-only feature → reference `architecture-web.md`.
   - API-only feature → reference `architecture-api.md`.
   - Full-stack → both + `integration-architecture.md`.

## Non-negotiable invariants (do not break)

1. `trackingCode` 32-char dashless uuid round-trip (revenue attribution).
2. HITL gate before storefront: `ProductExtraction`, `Article`, `Coupon`.
3. Admin shared-secret headers; `ADMIN_API_KEY` matched across apps.
4. `Niche.schemaConfig` per-niche dynamic; web reads via `normalizeProduct`.
