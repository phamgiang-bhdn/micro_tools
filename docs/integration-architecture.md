# Integration Architecture

> Generated 2026-06-17. How the two parts (api, web) and the external affiliate network communicate.

## Integration points

| From | To | Type | Details |
|---|---|---|---|
| web (server) | api | HTTP REST | `lib/api.ts` (`API_BASE_URL`, default `http://localhost:4000/api/v1`, `cache: no-store`). Public reads: niches, products, articles, coupons, top-products, prices, tool session. |
| web (server action) | api | HTTP POST | `createTrackingRedirect()` → `POST /tracking/click` (creates `ClickLog`), then `redirect()` to affiliate URL with `?utm_source=<trackingCode>`. |
| web admin actions | api admin | HTTP + headers | `adminFetch`/`post()` inject `x-admin-role` + `x-admin-key`; api `AdminController.authorize()` validates per-method. |
| Accesstrade | api | REST pull (cron/manual) | `/v1/campaigns`, `/v1/datafeeds`, `/v1/top_products`, `/v1/offers_informations/coupon`, `/v1/order-list`, `/v1/order-products`. See [integrations/accesstrade.md](./integrations/accesstrade.md). |
| Accesstrade | api | Webhook (real-time) | `POST /api/v1/webhooks/accesstrade` → `ConversionWebhook`, linked to `ClickLog` by `trackingCode`. |

## The revenue round-trip (critical contract)

```
web: user clicks "Xem deal"
  → createTrackingRedirect(): randomUUID().replace(/-/g,"") = 32-char trackingCode
  → POST /api/v1/tracking/click  → ClickLog(trackingCode, productId, channel, ...)
  → redirect(affiliateUrl + "?utm_source=" + trackingCode)
network: user converts
  → POST /api/v1/webhooks/accesstrade {trackingCode, revenue, status}
     → ConversionWebhook (source="webhook")
  → ReconciliationService @cron /v1/order-list  (match utm_source == trackingCode)
     → update ConversionWebhook (source "api-reconcile" | "both"), reconcileNotes on mismatch
```

**Never change** the `trackingCode` format or this round-trip — all revenue attribution depends on it.

## Shared contracts / coupling

- **`ADMIN_API_KEY`** must match across `apps/api/.env` and `apps/web/.env`.
- **`Niche.schemaConfig`** shape is shared: the api extractor writes it, web reads it via `normalizeProduct`. Don't hard-code field names on either side.
- **HITL state machines** (`ProductExtraction`, `Article`, `Coupon`) gate what web is allowed to display.

## Auth flow

No sessions. Admin = shared-secret header pair (`x-admin-role`, `x-admin-key`) on every admin request; roles `viewer | reviewer | admin`, least-privilege per endpoint. Public storefront is unauthenticated.
