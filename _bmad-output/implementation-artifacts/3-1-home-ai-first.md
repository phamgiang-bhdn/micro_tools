---
baseline_commit: 02086be
---
# Story 3.1: Trang chủ AI-first — AI advisor là nhân vật chính, catalog lùi vai phụ

Status: review

> Nguồn: party-mode 2026-06-18 (Sally/UX, John/PM, Mary/Analyst, Victor/Innovation) + quyết định của Giang: **dealvault là AI-advisor** (AI tư vấn là chính), KHÔNG phải catalog. Đồng thuận: trang chủ hiện lưỡng lự giữa "hỏi AI" (hero) và "tự lục catalog" (danh mục + grid), lại để **banner lỗi full-width + 'đang cập nhật' tràn lan** phơi bày sự trống rỗng giai đoạn pre-launch. Mục tiêu: dồn spotlight về AI (moat, chạy độc lập data), đẩy catalog xuống vai phụ (giữ cho SEO), biến trạng thái rỗng/lỗi từ "lời xin lỗi" thành "lời hứa".

## Story

As a **người dùng VN lần đầu vào dealvault (chưa biết nên mua gì)**,
I want **thấy ngay AI tư vấn mua sắm là giá trị chính + bằng chứng nó hoạt động, thay vì một sàn trống đang "bảo trì"**,
so that **tôi tin và thử hỏi AI ngay — thay vì kết luận "site này chưa xong" rồi thoát**.

## Bối cảnh (đã verify bằng code — [apps/web/app/page.tsx](../../apps/web/app/page.tsx))

Thứ tự render hiện tại trong `HomePage`:
1. `<AiAssistant />` ([page.tsx:52](../../apps/web/app/page.tsx)) — hero AI ("Hỏi AI nên mua gì" + ô search). **Client component; RENDER độc lập, KHÔNG phụ thuộc fetch niche/product** → khung hero luôn hiện kể cả khi `loadError`.
   - ⚠️ **Nhưng lời gọi AI KHÔNG độc lập** (đã verify): `askAssistant` fetch `${API_BASE_URL}/assistant/ask` ([app/actions/assistant.ts:27](../../apps/web/app/actions/assistant.ts)) — **cùng Nest API** với niche/product. Khi API sập toàn bộ → user gõ câu hỏi cũng nhận lỗi. May là `ai-assistant.tsx` đã có `status:"error"` + `errorMsg` ([ai-assistant.tsx:51-53](../../apps/web/components/storefront/ai-assistant.tsx)). Hệ quả: AI-first KHÔNG miễn nhiễm outage — chỉ chuyển "thông báo lỗi" từ banner tĩnh sang lỗi-sau-khi-hỏi. Xem AC#9.
2. **`loadError` block** ([page.tsx:54-70](../../apps/web/app/page.tsx)) — khi lỗi tải, render `<PageSection><EmptyState tone="warning" title="Hệ thống đang bảo trì">` **full-width, top-level, ngay dưới hero**. Đây là dải vàng to user phàn nàn.
3. `<PageSection "Khám phá theo danh mục">` + `<CuratedNicheGrid>` ([page.tsx:72-85](../../apps/web/app/page.tsx)) — 6 chip niche (vừa redesign ở story 2-1). `buildCuratedTiles` luôn trả 6 chip hardcode; khi niche chưa ACTIVE → copy **"Đang cập nhật"** ([curated-niche-grid.tsx](../../apps/web/components/storefront/curated-niche-grid.tsx)).
4. `#all-deals` ([page.tsx:87+](../../apps/web/app/page.tsx)) — sticky filter chip danh mục + `<ProductGrid>` (hoặc EmptyState rỗng/lỗi).

**Invariant bất biến (story 1-4 — KHÔNG được gãy):** `loadError = nichesError ?? (allProducts.length===0 ? productsResult.loadError : null)` ([page.tsx:27](../../apps/web/app/page.tsx)) — phân biệt **lỗi tải** (backend sập) vs **rỗng hợp lệ** (backend OK, chưa có product). Hai trạng thái phải giữ thông điệp khác nhau, KHÔNG gộp.

**Lưu ý kỹ thuật (party — John):** dải vàng đang thấy là `loadError` do **API local tắt**, có thể không xuất hiện ở production lúc chạy bình thường. Story vẫn đáng làm (lỗi không được chiếm cả trang + AI-first là định vị), nhưng đánh giá visual "thật" nên làm khi **bật API + seed 1 niche**.

## Phạm vi (SCOPE)

**TRONG scope** — thuần tầng trình bày + IA + copy của TRANG CHỦ:
- `apps/web/app/page.tsx` (thứ tự section, vị trí xử lý lỗi).
- `apps/web/components/storefront/curated-niche-grid.tsx` (copy "Đang cập nhật" → lời hứa).
- Thêm/đặt dải "bằng chứng AI" dưới hero — **tái dùng** component có sẵn nếu phù hợp ([trust-strip.tsx](../../apps/web/components/storefront/trust-strip.tsx), [social-proof-strip.tsx](../../apps/web/components/storefront/social-proof-strip.tsx)) thay vì viết mới.

**NGOÀI scope:**
- KHÔNG đụng `AiAssistant` logic (chỉ có thể chỉnh layout/khoảng cách quanh nó nếu cần).
- KHÔNG xoá catalog/`/categories/[slug]` (giữ nguyên cho SEO — chỉ lùi vai phụ trên home).
- KHÔNG đụng backend, `normalizeProduct`, `createTrackingRedirect`, HITL gate.
- Lead-capture (thu email/zalo) — chỉ làm ở mức **tái dùng** flow subscribe sẵn có nếu rẻ; nếu phải dựng mới → tách story 3-2.

## Acceptance Criteria

> AC đo bằng: cấu trúc code (vị trí section), grep copy, lint/build, design-guards, + visual. Mỗi AC nêu cách verify + có case lỗi.

1. **Lỗi tải KHÔNG còn là banner full-width chiếm spotlight đầu trang** — Verify: trong [page.tsx](../../apps/web/app/page.tsx), khi `loadError` truthy, KHÔNG render `<PageSection>` "Hệ thống đang bảo trì" như section top-level **giữa hero và danh mục**. Chỉ thị báo lỗi sống **trong khu vực `#all-deals` (grid sản phẩm)** — đúng nơi bị ảnh hưởng. Hero AI + dải bằng chứng + danh mục vẫn hiển thị và dùng được khi `loadError`.
   - Input: API niche/product sập (`loadError` truthy) → Output: màn đầu vẫn là AI hero + bằng chứng (không bị dải vàng to đè); thông báo lỗi nằm ở khu grid phía dưới, gọn.

2. **Hero AI "thở" + có bằng chứng moat ngay màn đầu** — Verify: ngay dưới `<AiAssistant />` có một dải **bằng chứng/trust** truyền tải đúng moat ("giá thật · cảnh báo giá ảo · AI tư vấn") — tái dùng `trust-strip`/`social-proof-strip` nếu hợp. Dải này render **độc lập với fetch product** (hiện cả khi `loadError`). Khoảng trắng lớn dưới hero biến mất.
   - Input: bất kỳ trạng thái data nào (kể cả lỗi) → Output: dưới hero luôn có nội dung sống chứng minh AI/giá-thật, không phải khoảng trắng trống.

3. **Thứ tự AI-first: catalog lùi vai phụ** — Verify: thứ tự section trong [page.tsx](../../apps/web/app/page.tsx): (1) AI hero + bằng chứng — trên cùng, nổi bật; (2) danh mục + grid sản phẩm — BÊN DƯỚI, là lối phụ cho ai muốn tự lục. Danh mục KHÔNG nằm trên hero. `/categories/[slug]` giữ nguyên (SEO).
   - Edge: KHÔNG xoá grid/filter (vẫn phục vụ user tự duyệt + SEO) — chỉ đổi vị trí/độ ưu tiên thị giác.

4. **Reframe "Đang cập nhật" → lời hứa** — Verify (grep): trong [curated-niche-grid.tsx](../../apps/web/components/storefront/curated-niche-grid.tsx), nhánh `productCount === 0` KHÔNG còn chuỗi "Đang cập nhật"; thay bằng tone lời hứa (vd "Sắp lên kệ"). Nhánh `productCount > 0` giữ hiển thị số deal thật.
   - Input: niche chưa ACTIVE (count 0) → Output: chip hiện "Sắp lên kệ" (hoặc tương đương), không phải "Đang cập nhật".

5. **GIỮ invariant empty-vs-error (story 1-4)** — Verify: phân biệt **lỗi tải** vs **rỗng hợp lệ** KHÔNG bị gộp. Trong khu grid: `loadError` truthy → thông điệp "đang khắc phục/thử lại" (tone warning); `!loadError && sorted.length===0` → thông điệp "đang cập nhật deal mới/sắp lên kệ" (tone neutral). Hai nhánh vẫn tách biệt như [page.tsx:125-140](../../apps/web/app/page.tsx) hiện có — chỉ đổi VỊ TRÍ/độ phô trương, không đổi LOGIC phân biệt.
   - Input lỗi (API sập) vs input rỗng (API OK, 0 product) → Output: hai thông điệp khác nhau, không cái nào giả làm cái kia.

6. **Không regression SEO/ISR/tracking/HITL/guard** — Verify: `npm run lint:web` ✓; `npm run build --workspace web` ✓; `node apps/web/scripts/design-guards.mjs` 9/9 xanh; product grid vẫn render qua `normalizeProduct`; click "Xem deal" round-trip `utm_source` không đổi; metadata/JSON-LD ở layout không đụng; KHÔNG thêm dynamic mới (home đã dynamic do `searchParams`, đừng làm xấu thêm).

7. **~~Lead-capture~~ → ĐÃ TÁCH story 3-2** (checkpoint 2026-06-18): thu email/zalo ở trạng thái rỗng là feature độc lập, KHÔNG nằm trong 3-1. Story này giữ gọn ở bố cục AI-first. (3-2 sẽ tái dùng [subscribe-modal.tsx](../../apps/web/components/storefront/subscribe-modal.tsx).)

8. **AI-first là ƯU TIÊN, không phải ĐỘC QUYỀN — link catalog phải còn trong DOM** (steelman/SEO) — Verify: dù catalog lùi xuống thị giác, **link `/categories/<slug>` của 6 chip + grid sản phẩm vẫn nằm trong HTML home** (không `display:none`, không client-only ẩn) → giữ internal-linking cho SEO + lối "tự duyệt" cho user quen browse. Đường browse phải **với tới trong 1 lần cuộn**, không bắt mọi người chui qua chat AI.
   - Input: SEO bot / user quay lại muốn tự lục → Output: vẫn thấy link danh mục + grid khi cuộn, không bị AI hero nuốt hẳn.
   - Edge: KHÔNG được "demote" bằng cách bỏ render catalog khi có data — chỉ hạ vị trí/độ nổi.

9. **AI outage graceful — không thành ngõ cụt** (pre-mortem) — Verify: khi API sập (`loadError`) và user vẫn gõ hỏi AI → `ai-assistant` hiện `status:"error"` với copy **trấn an + lối thoát** (vd "Hệ thống đang bận, thử lại sau ít phút / xem cẩm nang"), KHÔNG phải lỗi trần trụi. Vì hero giờ là mặt tiền, lỗi-sau-khi-hỏi không được tệ hơn banner cũ.
   - Input: API down + user submit câu hỏi → Output: thông báo lỗi thân thiện có CTA thay thế, không treo/không trắng. (Copy ở [ai-assistant.tsx:120-122](../../apps/web/components/storefront/ai-assistant.tsx) — chỉnh tone nếu cần, KHÔNG đụng logic.)

## Guard "red test" (thay Jest — web không có framework)

Script: [apps/web/scripts/home-ai-first-guards.mjs](../../apps/web/scripts/home-ai-first-guards.mjs). Chạy: `node apps/web/scripts/home-ai-first-guards.mjs`.
- **Trước dev: 4/5 ĐỎ** (H1,H2,H3,H5) — bắt đúng hiện trạng; **H4 XANH** = invariant empty-vs-error phải GIỮ.
- Sau `/bmad-dev-story 3-1`: tất cả XANH + `lint:web` + `build web` + `design-guards.mjs` (2-1) vẫn 9/9.
- Map guard ↔ AC: H1→AC4 (bỏ "Đang cập nhật"), H2→AC2 (có dải bằng chứng), H3→AC1 (lỗi không banner top), H5→AC2-edge (bằng chứng luôn hiện, không kẹt trong nhánh `loadError`), H4→AC5 (invariant giữ).
- **Không grep được → verify tay/visual**: AC3 (thứ tự catalog dưới — hiện đã đúng vì category ở [page.tsx:72](../../apps/web/app/page.tsx) sau hero [:52]), AC6 (lint/build/tracking/HITL), **AC8** (link catalog còn trong DOM server-rendered — kiểm View Source khi `loadError`), **AC9** (copy lỗi AI trấn an + CTA — thử submit khi API tắt).
- **Known limit H3**: nếu dev đổi hẳn copy lỗi (bỏ "đang bảo trì") mà vẫn để banner top → H3 lọt. Phải verify mắt: khu đầu trang khi `loadError` KHÔNG có dải cảnh báo full-width.

## Rủi ro & giảm thiểu (pre-mortem + second-order)

- **R1 — AI cũng chết khi API sập** (đã verify, xem AC#9): hero hứa AI nhưng `askAssistant` cùng API → outage = hỏi xong nhận lỗi. → copy lỗi AI phải trấn an + có CTA thay thế; đừng quảng bá "AI luôn sống".
- **R2 — Demote catalog làm loãng internal-link SEO** (steelman/second-order): home là hub link tới `/categories/*`. Đẩy catalog xuống mà vẫn giữ link trong DOM thì OK (AC#8); nếu lỡ ẩn/lazy-client → mất link-equity, giảm crawl. → giữ link server-rendered.
- **R3 — "Sắp lên kệ" lặp lại nhiều tuần = "Đang cập nhật" phiên bản mới**: đổi chữ KHÔNG chữa được catalog rỗng kéo dài; user quay lại vẫn thấy hứa suông. → phụ thuộc **story 3-2 (lead-capture)** để biến chờ đợi thành cam kết; ghi rõ dependency, đừng coi reframe là đủ.
- **R4 — Chi phí AI tăng theo traffic home** (second-order): hero nổi → nhiều lượt `askAssistant` → tải + token cost lên Nest/AI. → ops cần biết; không chặn story nhưng nêu để theo dõi.
- **R5 — Trust-strip rỗng/generic vẫn thấy sparse**: nếu dải bằng chứng chỉ là khẩu hiệu suông, khoảng trắng "được trang trí" chứ chưa hết. → dùng `trust-strip` có nội dung cụ thể (giá đối chiếu, nguồn chính hãng, cập nhật mỗi giờ — đã có sẵn), cân nhắc thêm 1 số liệu động thật.

## Edge cases (boundary sweep)

- **Tất cả 6 niche ACTIVE** (count>0): chip hiện số deal thật, KHÔNG "Sắp lên kệ" — AC#4 nhánh `productCount>0` giữ nguyên.
- **Hỗn hợp** (vài active, vài chưa): chip trộn count thật + "Sắp lên kệ" — chấp nhận.
- **`loadError` + có `searchParams`** (user vào qua link `?category=&q=` đúng lúc outage): grid báo lỗi, hero vẫn hiện; KHÔNG crash, filter không vỡ.
- **Mobile**: fold ngắn → trust-strip phải **gọn trên mobile** (đừng đẩy catalog quá sâu). Rà responsive.
- **AI trả 0 pick / câu hỏi vô nghĩa**: `ai-assistant` đã xử (status done + empty) — không thuộc scope story này nhưng đừng làm hồi quy.

## Góc nhìn stakeholder (lens rotation)

- 🔁 **User quay lại (quen browse)**: phải với tới grid/danh mục trong 1 cuộn (AC#8) — đừng ép qua chat.
- 💰 **Đối tác affiliate**: thấy AI-first → "khác biệt", nhưng vẫn cuộn thấy grid rỗng → R3 nhấn mạnh cần 3-2.
- 🤖 **SEO bot**: cần link catalog + text trên home → AC#8 giữ link server-rendered.
- 📱 **User mobile**: trust-strip gọn, hero không chiếm 2 màn → cân bằng "thở" vs "đẩy nội dung quá sâu".

## Tasks / Subtasks

- [x] **Task 1 — Tái bố cục lỗi** (AC #1,#5): gỡ `loadError` PageSection top-level; thêm nhánh lỗi vào khu `#all-deals` ([page.tsx](../../apps/web/app/page.tsx)). Giữ tách empty-vs-error.
- [x] **Task 2 — Dải bằng chứng AI dưới hero** (AC #2): chèn `<TrustStrip />` (tái dùng) trong `<PageSection padding="tight">` ngay dưới `<AiAssistant />`, NGOÀI nhánh loadError → luôn hiện.
- [x] **Task 3 — Thứ tự AI-first** (AC #3): hero + proof trên cùng; danh mục + grid dưới (đã đúng, xác nhận). Catalog `/categories` không đụng.
- [x] **Task 4 — Reframe copy** (AC #4): `curated-niche-grid` "Đang cập nhật" → "Sắp lên kệ".
- [x] **Task 5 — lead-capture** (AC #7): **N/A — đã tách story 3-2** (quyết định checkpoint). Không làm ở 3-1.
- [x] **Task 6 — Giữ link catalog + AI error tone** (AC #8,#9): link `/categories/*` (CuratedNicheGrid) + grid vẫn server-rendered, luôn trong DOM (verify) ✓; copy lỗi `ai-assistant` → trấn an + CTA `/blog`, giữ `errorMsg` phụ, KHÔNG đụng logic.
- [x] **Task 7 — Gate** (AC #6): `home-ai-first-guards` 5/5 ✓ · `design-guards` 9/9 ✓ · `lint:web` ✓ · `tsc` file-sửa sạch ✓. (Build prod bỏ theo [[feedback_no_prod_build]]; visual ở cả 2 trạng thái + mobile → user rà.)

## Dev Notes

- **Tái dùng, đừng viết mới**: kiểm [trust-strip.tsx](../../apps/web/components/storefront/trust-strip.tsx) + [social-proof-strip.tsx](../../apps/web/components/storefront/social-proof-strip.tsx) trước khi tạo dải bằng chứng. Mục tiêu copy: "giá thật · cảnh báo giá ảo · AI tư vấn 60 giây".
- **AI chạy độc lập**: `AiAssistant` không cần niche/product fetch → dải bằng chứng + hero phải nằm NGOÀI nhánh `loadError` (luôn hiện).
- **Invariant 1-4**: đọc kỹ [page.tsx:24-27](../../apps/web/app/page.tsx) — đừng gộp `nichesError` và "rỗng hợp lệ". Story này chỉ DỜI chỗ hiển thị lỗi, không đổi cách tính `loadError`.
- **SEO**: home đã dynamic do đọc `searchParams` (filter/sort/q) — đừng coi như ISR-static. Catalog `/categories/[slug]` là bề mặt SEO chính, KHÔNG đụng. Sitemap/robots không đổi.
- **trackingCode/HITL/normalizeProduct**: ProductGrid → ProductCard → normalizeProduct giữ nguyên; chỉ dời vị trí khối, không đổi data path.
- **Không có test web**: verify = lint + build + design-guards + visual (2 trạng thái).

### Project Structure Notes
- Sửa: `apps/web/app/page.tsx`, `apps/web/components/storefront/curated-niche-grid.tsx`, (tái dùng) `trust-strip.tsx`/`social-proof-strip.tsx`.
- Giữ nguyên: `AiAssistant`, `/categories/*`, backend.

### References
- [Source: apps/web/app/page.tsx#L19-L70] (thứ tự section + loadError block)
- [Source: apps/web/app/page.tsx#L24-L27] (invariant empty-vs-error story 1-4)
- [Source: apps/web/components/storefront/curated-niche-grid.tsx] (copy "Đang cập nhật")
- [Source: apps/web/CLAUDE.md#SEO-surface] (catalog/SEO không đụng) ; [#No-test-suite-here] (verify = lint+build)
- Party-mode 2026-06-18 (định vị AI-advisor) — xem [[project_design_overhaul_2_1]], [[project_ai_visible_required]]

## Dev Agent Record
### Agent Model Used
claude-opus-4-8[1m]

### Completion Notes List
- **AC1+AC5 (Task 1)**: gỡ `<PageSection>` "Hệ thống đang bảo trì" top-level (giữa hero & danh mục). Thêm nhánh `{loadError ? <EmptyState "Không tải được deal lúc này"/> : null}` BÊN TRONG `#all-deals` — lỗi nằm đúng khu grid, gọn. Nhánh "rỗng hợp lệ" `{!loadError && sorted.length===0 ...}` giữ nguyên → invariant empty-vs-error (story 1-4) còn tách (guard H4 xanh).
- **AC2 (Task 2)**: `<TrustStrip />` (tái dùng, 4 điểm: giá đối chiếu · nguồn chính hãng · cập nhật mỗi giờ · cẩm nang) đặt trong `<PageSection padding="tight">` ngay dưới hero, NGOÀI nhánh loadError → hiện mọi trạng thái, lấp khoảng trắng. Server component, không thêm dynamic/client.
- **AC3 (Task 3)**: thứ tự giữ hero → proof → danh mục → grid; catalog ở vai phụ. `/categories/[slug]` không đụng (SEO).
- **AC4 (Task 4)**: chip niche count=0 hiện "Sắp lên kệ" (thay "Đang cập nhật"); count>0 giữ số deal thật.
- **AC8 (Task 6)**: link `/categories/*` của 6 chip (`CuratedNicheGrid`, luôn render 6 từ `buildCuratedTiles`) + `ProductGrid` đều server-rendered, không ẩn → internal-link SEO + lối browse còn nguyên.
- **AC9 (Task 6)**: `ai-assistant` status="error" → khối `role="alert"` tone warning: tiêu đề trấn an + CTA `/blog`, `errorMsg` thành dòng phụ nhỏ. KHÔNG đụng logic (status/setErrorMsg nguyên).
- **AC6 (Task 7)**: `home-ai-first-guards.mjs` 5/5 xanh, `design-guards.mjs` 9/9 xanh, `lint:web` ✓, `tsc --noEmit` 0 lỗi ở file sửa. trackingCode/HITL/normalizeProduct không đụng (chỉ dời vị trí khối render).
- **Gate readiness**: materialize `implementation-readiness-report-3-1.md` (verdict PASS từ /story-ready) để thỏa team-gate trước khi code.
- ⚠️ **Còn cần rà mắt (user)**: visual home ở 2 trạng thái (lỗi / có data sau seed 1 niche) + mobile (trust-strip gọn). Build prod bỏ theo preference.

### File List
- apps/web/app/page.tsx (M) — gỡ banner lỗi top, thêm TrustStrip dưới hero, dời lỗi vào #all-deals
- apps/web/components/storefront/curated-niche-grid.tsx (M) — "Đang cập nhật" → "Sắp lên kệ"
- apps/web/components/storefront/ai-assistant.tsx (M) — copy lỗi AI trấn an + CTA (AC9)
- _bmad-output/planning-artifacts/implementation-readiness-report-3-1.md (A) — report thỏa team-gate
- apps/web/scripts/home-ai-first-guards.mjs (A, từ /story-ready) — guard regression

### Change Log
- 2026-06-18: Tạo story 3-1 qua /story-ready, grounded vào page.tsx thật. Định vị AI-advisor (party-mode). Status → ready-for-dev.
- 2026-06-18: Checkpoint user duyệt case list ("ok"). Chốt: AC7 lead-capture → tách story 3-2. Edge-hunt thêm H5 (bằng chứng phải luôn hiện, không kẹt nhánh loadError). Tạo guard `home-ai-first-guards.mjs` (4/5 ĐỎ + H4 invariant xanh). Readiness: PASS.
- 2026-06-18: /elicit-batch (5 method) — verify `askAssistant` cùng API (sửa premise: AI render độc lập NHƯNG call không), thêm AC#8 (link catalog giữ DOM/SEO + AI-first ưu-tiên-không-độc-quyền), AC#9 (AI outage graceful), section Rủi ro (R1-R5), Edge sweep, Stakeholder lens. Cập nhật Tasks 6-7.
- 2026-06-18: IMPLEMENT (/bmad-dev-story 3-1). Gỡ banner lỗi top-level → dời vào #all-deals; +TrustStrip dưới hero (luôn hiện); chip "Sắp lên kệ"; AI error copy trấn an+CTA. Guards 5/5 + 9/9, lint ✓, tsc sạch. AC7 N/A (tách 3-2). Status → review.

## Elicitation log (2026-06-18)

- **#34 Steelmanning** — dựng mạnh phe "catalog-first": SEO internal-link + thói quen browse + AI fallback. Kết quả: thêm **AC#8** (link catalog phải còn server-rendered trong DOM; AI-first = ưu tiên không độc quyền; browse với tới trong 1 cuộn).
- **#57 Pre-mortem** — giả định AI-first home tệ hơn sau 1 tháng → R1 (AI chết cùng API), R3 ("Sắp lên kệ" lặp = trust erosion mới → phụ thuộc 3-2), R5 (trust-strip generic vẫn sparse). Thêm **AC#9** (AI outage graceful).
- **#30 Second-Order Thinking** — R2 (demote catalog → loãng internal-link/crawl nếu ẩn link), R4 (traffic hero ↑ → chi phí AI ↑).
- **#69 Boundary & Edge Case Sweep** — thêm section Edge: all-active vs hỗn hợp niche, `loadError`+`searchParams`, mobile fold/trust-strip gọn, AI 0-pick.
- **#45 Stakeholder Lens Rotation** — góc user-quay-lại / affiliate / SEO-bot / mobile → củng cố AC#8 + lưu ý responsive.

> ✅ **Đã quyết (Giang giao "tự quyết" 2026-06-18):**
> 1. **R1/AC#9 — outage premise**: **CHẤP NHẬN "lỗi-sau-khi-hỏi" + copy trấn an** (AC#9). Fallback cứng (phát hiện API down → ẩn ô hỏi) **LOẠI** — nó ẩn moat khỏi mặt tiền (phản AI-first), cần health-check riêng (phình scope), và `ai-assistant` đã có `status:"error"` sẵn. Nếu sau cần health-check chủ động → story riêng.
> 2. **R3 — dependency 3-2**: **3-1 ship độc lập TRƯỚC** (tự đứng được). **3-2 lead-capture = story kế tiếp NGAY SAU** (không song song — tránh rối scope; R3 chỉ thành vấn đề khi catalog rỗng *kéo dài*). 3-1 KHÔNG bị chặn bởi 3-2.
