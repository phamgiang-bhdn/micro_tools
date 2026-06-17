# Refactor V4 — Reposition sang "AI deal-intelligence", KHÔNG rewrite

Quyết định ngày 2026-06-03. Dựa trên 2 vòng deep-research (AI search + hệ sinh thái affiliate VN) + audit toàn bộ codebase thật.

## TL;DR

App đang pre-launch, đã có **~80% hạ tầng cho hướng mới**. V4 **không phải cách mạng code** — là **tái định vị sản phẩm + đắp 1 lớp dữ liệu giá real-time**. "Refactor hết" bị bác bằng chính code: nó sẽ phá `ToolModule`, attribution đa kênh, AI pipeline — những thứ đã hiện thực hoá đúng chiến lược này.

## Vì sao đổi hướng (kết luận research, đã verify)

- **AI Overview ăn 83% truy vấn "X nào tốt nhất"** (informational) nhưng chỉ ~13-14% truy vấn giao dịch/tên-model → blog so sánh là vùng chết, giao dịch/long-tail còn sống.
- **CTR top-1 giảm 58% khi có AIO**; RCT: zero-click 54%→72%. SEO informational là kênh đang co.
- **Người VN mua qua social/video/livestream** (TikTok Shop 42% share, +148% YoY), không qua text search.
- **Real-time price/inventory + tool tương tác** là vùng AI KHÔNG thay được → đây là moat.
- **Network**: đi đa network (in-house sàn rate cao + Accesstrade track social S2S tốt nhất). Shopee bậc khách-mới 6.7% vs cũ 1.4% → nhắm người mua lần đầu. Dòng tiền: đối soát 2-4 tháng + claw-back → tính theo đơn-đã-đối-soát.

## Định vị mới (1 câu)

Từ **"site so sánh kiếm SEO"** → **"AI soi deal thật/ảo + tư vấn mua đúng món, đúng lúc, rẻ nhất"** cho gia dụng/smart home, phân phối social/deal-feed, kiếm tiền đa network.

> Test cho mọi tính năng AI: *"Cái này ChatGPT có tự làm cho user được không?"* Nếu có → slop, bỏ. Nếu không (vì cần data giá VN sống / hành động liên tục) → moat, làm.

---

## ĐÃ CÓ — KHÔNG đụng (audit code xác nhận)

- `ToolModule`: ToolScoringService (deterministic) + ToolAiService (reasoning) + ReasoningCache. Tool/QuizSession. → **chính là tool AI-visible**, chỉ thiếu CTA redirect ở result.
- FE `/ai/[slug]` + `/quiz` + `/result/[sessionId]` + QuizStepFlow + `submitToolSession`.
- `ClickLog.channel` (fb/zalo/email/organic) + `marketplace` (tiki/shopee/lazada/tiktokshop) + `toolId` + `quizSessionId`.
- `Product.network` enum đa network. `AccesstradeClient` mature (datafeeds/campaigns/order-list/order-products/top_products/coupon).
- `AiService` provider-agnostic. HITL 3 tầng (ProductExtraction/Article/Coupon). Design system trust-blue.
- `TopProductSnapshot` = tiền lệ time-series có lịch sử.

## BẤT BIẾN — tuyệt đối không phá

- `trackingCode` = `randomUUID().replace(/-/g,"")` (32 ký tự).
- `POST /tracking/click` body + `?utm_source=<code>`; `POST /webhooks/accesstrade` shape.
- HITL gate cho mọi data ra storefront (CONTEXT.md: lý do compliance + brand-trust). Data-giá-thuần có thể qua rule-validation; claim biên tập **vẫn full HITL**.
- AccesstradeClient endpoints/params.

---

## DELTA V4 (chỉ đắp thêm)

### Backend (apps/api)
1. **`PriceSnapshot`** (model mới): `productId, price, originalPrice, source/marketplace, fetchedAt`. Index `(productId, fetchedAt desc)`. Ghi 1 row/product mỗi crawl cycle (hook vào `CrawlerService.runFullCycle` đã có).
2. **`PriceIntelligenceService`** (mới, trong InsightsModule): từ PriceSnapshot tính `lowest30d/90d`, `avgPrice`, `priceVelocity`, và **deal verdict** = `THẬT | ẢO | ĐÁY_N_NGÀY` (phát hiện anchor giả: originalPrice thổi vs lịch sử thật).
3. **`PriceAlert`** (model mới) + notify qua `Subscriber`/push đã có: rớt giá ngưỡng → đẩy deal-feed (Zalo OA/Telegram/FB).
4. *(Phase 2, gate)* **AgentCrawlService**: lớp depth-crawl (computer-use/browser agent) chỉ chạy SKU hot — verify giá ảo + tồn kho thật. Breadth vẫn dùng datafeed (rẻ); agent chỉ đánh depth (đắt).

### Frontend (apps/web)
5. **Deal verdict badge** trên product card + product detail + tool result (tái dùng `normalizeProduct`, thêm field từ PriceIntelligence).
6. **Price-history chart** ở product detail (dữ liệu từ PriceSnapshot).
7. **CTA redirect ở tool result** (`/ai/[slug]/result`) — hiện chỉ đọc info, thêm `createTrackingRedirect` đã có.
8. **Trang programmatic transactional** ("giá [model] tháng X — rẻ nhất ở đâu") — nhắm long-tail 13-14% AI chưa đụng. **Phải data-backed thật** (né Google scaled-content penalty).
9. **Blog**: KHÔNG xoá. Demote — ngừng đầu tư "best X" evergreen, giữ transactional. Article pipeline giữ nguyên, đổi vai sinh deal-post/script.

---

## Roadmap (validate trước, gate từng phase)

### Phase 0 — Đóng V3 + validate (KHÔNG code mới)
- Chạy migration `cut_taxonomy` (tắt dev:api trước) + quyết taxonomy merge hoặc park rõ ràng.
- Đăng ký Accesstrade + LazAffiliates → rate thật ngành gia dụng.
- Reality-check 30 keyword transactional trên Google.vn/ChatGPT.
- Hỏi 10 người: có muốn "web báo deal thật/ảo" không?
- **Gate:** tín hiệu dương mới sang Phase 1.

### Phase 1 — Moat dữ liệu giá (delta 1-3, 5-7)
- PriceSnapshot + PriceIntelligenceService + deal verdict badge + price chart + tool CTA.
- 1 niche duy nhất (gia dụng/smart home), ~50-100 SKU.
- **Gate:** deal verdict đúng trên data thật + tool result ra link tracked.

### Phase 2 — Phân phối + alert (delta 3, 8)
- PriceAlert + 1 kênh deal-feed (Zalo/Telegram) auto-post.
- Programmatic transactional pages.
- **Gate:** đo click→đơn; có EPC dương sau đối soát mới scale.

### Phase 3 — Agent depth (delta 4) — chỉ khi Phase 1-2 dương
- AgentCrawlService soi giá ảo + tồn kho SKU hot.

## Giả định tài chính (điền số thật ở Phase 0)
- Đối soát 2-4 tháng; claw-back hoa hồng tạm-duyệt; tính theo đơn-đã-đối-soát.
- Shopee Smartlink-qua-AT: ~2% cap 30k/đơn → ưu tiên in-house cho món giá cao.
- Bậc khách-mới Shopee 6.7% vs 1.4% → tool nhắm người mua lần đầu.

## Cảnh báo neo
- **Badge AI là bao bì, không phải nền móng** — nền là capability (data giá sống). Slop AI sẽ làm badge phản tác dụng trong 12-18 tháng.
- **Đừng rewrite.** Mỗi lần gọi "đại cách mạng" là một cớ xây thêm thay vì validate. App vẫn 0 user — rủi ro lớn nhất là không bao giờ ship.
