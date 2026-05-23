# STORY-09 — Brand reframe: Vietnamese tagline + footer rewrite + About page

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P0
**Estimate:** 3h
**Dependencies:** Không có hard dep. Có thể start trước STORY-02/03 vì chỉ đụng text + footer + 1 new page.

## Context

User feedback 2026-05-23:
- Tên `dealvault` user VN không đọc được/không hiểu/không nhớ → 0 organic word-of-mouth.
- Footer hiện tại có mention **"Accesstrade"** — B2B affiliate network, end-user không biết là gì, làm trang nhìn unprofessional ("đối tác merchant: Accesstrade" — confusing).
- Không có About page (`/ve-chung-toi`) → user không biết dealvault là ai, làm sao chọn deal, affiliate hoạt động ra sao → không tin.
- Tone copy còn Vinglish: "deal hunter", "săn deal" repeat, "vibe", "cool". Cần audit tone-of-voice.

**Pattern affiliate VN brand work**:
- Logo có **Vietnamese tagline 1 dòng** ngay dưới (cellphones: "Tổng kho điện thoại"; sforum: "Kênh đánh giá tech").
- Footer có **trust badges**: logo Lazada/Shopee/Tiki/TikTok với chữ "đối tác chính thức" — không mention network B2B.
- About page có 3 section bắt buộc: "Chúng tôi là ai", "Cách chúng tôi chọn deal", "Affiliate hoạt động thế nào" — minh bạch + giáo dục user.
- Tone of voice: trung tính-bạn bè, không nói "siêu phẩm", không cảm thán "tuyệt vời", không emoji thừa.

**Quyết định brand name**:
Sprint này KHÔNG rename domain — `dealvault` đã có domain đầu tư, rename = mất SEO + thay logo. Thay vào đó:
- Giữ `dealvault` làm tech name + domain.
- Thêm **Vietnamese tagline** rõ ràng ngay dưới logo trong header + footer + meta.
- Cấp 2 sau (separate ticket): consider rename → "DealHay" / "GiáTốt" / "MuaKhôn" — business decision của owner, separate sprint.

## User story

> **As** user VN landing dealvault.vn lần đầu,
> **I want** ngay 5 giây đầu hiểu site này là cái gì, chọn deal thế nào, kiếm tiền ra sao,
> **so that** tôi tin tưởng click outbound + có khả năng share/quay lại.

## Acceptance criteria

### AC1 — Brand constants centralization

NEW file: `apps/web/lib/brand.ts`.

```ts
export const BRAND = {
  name: "dealvault",
  taglineShort: "Săn deal khôn — đối chiếu giá thật",
  taglineLong: "Tổng hợp ưu đãi từ Shopee, Lazada, TikTok Shop, Tiki — giá rõ, mã rõ, click thẳng ra sàn.",
  domain: "dealvault.vn",
  email: "lienhe@dealvault.vn",
  founded: "2026",
  partners: [
    { name: "Lazada", slug: "lazada", logo: "/partners/lazada.svg" },
    { name: "Shopee", slug: "shopee", logo: "/partners/shopee.svg" },
    { name: "Tiki", slug: "tiki", logo: "/partners/tiki.svg" },
    { name: "TikTok Shop", slug: "tiktok", logo: "/partners/tiktok.svg" },
    { name: "Nguyễn Kim", slug: "nguyenkim", logo: "/partners/nguyenkim.svg" }
  ]
} as const;
```

Sau này muốn rename domain/name = đổi 1 chỗ.

### AC2 — Header tagline

File: `apps/web/components/layout/header.tsx` (verify path).

Dưới logo (desktop ≥1024px): thêm 1 dòng small text:

```tsx
<div className="flex flex-col">
  <span className="text-lg font-bold text-brand-700">{BRAND.name}</span>
  <span className="hidden text-[10.5px] font-medium uppercase tracking-wider text-ink-mute lg:block">
    {BRAND.taglineShort}
  </span>
</div>
```

Mobile: chỉ logo name, KHÔNG show tagline (đã có trong hamburger menu top).

### AC3 — Footer rewrite

File: `apps/web/components/layout/footer.tsx` (verify path).

Current structure (3 col + bottom row), audit + rewrite:

**Cột 1 — Khám phá**:
- Tất cả danh mục → `/danh-muc`
- Deal hot hôm nay → `/deal-hot`
- Mã giảm còn dùng → `/khuyen-mai`
- Cẩm nang chọn mua → `/blog`

**Cột 2 — Về dealvault**:
- Vì sao chọn dealvault → `/ve-chung-toi`
- Cách chúng tôi chọn deal → `/ve-chung-toi#cach-chon-deal`
- Liên hệ → `/lien-he`
- ~~Đối tác merchant~~ (REMOVE — confusing)

**Cột 3 — Pháp lý**:
- Tuyên bố affiliate → `/tuyen-bo-affiliate`
- Chính sách bảo mật → `/chinh-sach-bao-mat`
- Điều khoản sử dụng → `/dieu-khoan`

**Top section — Partner badges row** (NEW):

```tsx
<div className="border-b border-line py-6">
  <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
    Đối tác chính thức
  </p>
  <div className="mt-3 flex flex-wrap items-center gap-6">
    {BRAND.partners.map(p => (
      <img key={p.slug} src={p.logo} alt={p.name} className="h-7 object-contain opacity-70" />
    ))}
  </div>
</div>
```

**Bottom row** — copyright + tagline + affiliate disclosure:

```tsx
<div className="flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
  <p>© 2026 {BRAND.name}. {BRAND.taglineShort}.</p>
  <p className="max-w-md text-[11px]">
    Một số liên kết trên trang có thể giúp chúng tôi nhận hoa hồng. Giá hiển thị tại thời điểm cập nhật dữ liệu.
  </p>
</div>
```

**Critical**: Audit grep và remove tất cả mention "Accesstrade" trong footer + meta + any user-facing copy. Backend code (api/services) giữ nguyên (đó là tech, không user-facing).

### AC4 — About page `/ve-chung-toi`

NEW file: `apps/web/app/ve-chung-toi/page.tsx`.

Content (Vietnamese, tone trung tính-bạn bè, ~600 từ tổng):

```markdown
# {BRAND.name} là ai?

Chúng tôi là một team nhỏ ở Việt Nam, làm dealvault để giúp bạn tiết kiệm thời gian săn deal và mua sai sản phẩm.

Mỗi ngày các sàn lớn (Shopee, Lazada, TikTok Shop, Tiki, Nguyễn Kim) tung hàng nghìn ưu đãi — nhưng giá hiển thị thường đã bị tăng trước flash sale, mã giảm thì hết hạn nhanh, review trên sàn thường có sponsored thiếu khách quan. Bạn cần một nơi đối chiếu giá thật, lọc deal chính hãng, và link 1-click ra sàn.

dealvault làm đúng việc đó.

## Cách chúng tôi chọn deal {#cach-chon-deal}

Chúng tôi không ngồi gõ tay. Hệ thống chúng tôi pull dữ liệu từ API chính thức của các affiliate network (Accesstrade là một trong số đó — bạn có thể bỏ qua tên này, đó là kỹ thuật phía sau). Sau đó:

1. **Lọc nguồn**: chỉ giữ deal từ shop có badge Mall/Trading hoặc shop chính hãng — bỏ qua shop dạng "reseller" giá hên xui.
2. **Đối chiếu giá**: so sánh giá sau giảm với giá gốc thật (không phải giá gốc đã được "phù phép" trước flash sale). Nếu chênh lệch >20% so với giá thường ngày của sản phẩm → đánh badge "Đối chiếu xong".
3. **Loại trùng**: cùng 1 sản phẩm xuất hiện trên 3 sàn — chúng tôi pick deal giá tốt nhất, badge merchant rõ.
4. **Cập nhật giờ**: giá đổi mỗi giờ. Mỗi card có ngày-giờ đối chiếu.

Cộng đồng dealvault không có "siêu deal hôm nay duy nhất". Nếu bạn thấy site nào nói vậy, hãy nghi ngờ.

## Bài viết & review

Bên cạnh deal, chúng tôi viết cẩm nang chọn mua + review chi tiết các sản phẩm trong từng danh mục. Bài do team người viết (chúng tôi có 4 tác giả với chuyên môn khác nhau — đọc bio trong từng bài).

AI hỗ trợ chúng tôi nghiên cứu thông số, tổng hợp review tiếng Anh-Trung-Hàn, làm bảng so sánh. Nhưng góc nhìn, đánh giá ưu/nhược, recommendation cuối — tất cả là người. Mỗi bài đều có ngày cập nhật + tác giả + nguồn tham khảo.

## Affiliate hoạt động thế nào {#affiliate}

Khi bạn click "Xem deal ngay" trên dealvault, chúng tôi gắn 1 mã định danh (32 ký tự) vào link và chuyển bạn tới sàn. Nếu bạn mua trong vòng cookie window của sàn (thường 7-30 ngày), sàn trả cho chúng tôi 1 khoản hoa hồng nhỏ — **bạn không phải trả thêm phí gì**.

Hoa hồng này là tất cả doanh thu chúng tôi có — không có quảng cáo banner, không bán dữ liệu cá nhân, không trick affiliate kiểu cookie stuffing.

Vì sao chúng tôi minh bạch: nếu chúng tôi đề xuất deal kém cho bạn, bạn không mua hoặc hủy đơn, hoa hồng = 0. Lợi ích của chúng tôi 100% align với việc giới thiệu đúng deal.

## Liên hệ

- Email: {BRAND.email}
- Facebook: facebook.com/dealvaultvn (đang xây)
- Zalo OA: (sắp ra mắt)

Đặt câu hỏi, gửi feedback, report giá lỗi — chúng tôi đọc hết.
```

Render: 1-column max-width 720px, prose typography. Anchor link `#cach-chon-deal` + `#affiliate` work với scroll-smooth.

Metadata:
- title: "Về {BRAND.name} — Cách chúng tôi chọn deal"
- description: "{BRAND.name} là dự án giúp người Việt mua thông minh hơn. Cách chúng tôi đối chiếu giá, chọn nguồn chính hãng, và minh bạch về affiliate."

### AC5 — Affiliate disclosure dedicated page

NEW file: `apps/web/app/tuyen-bo-affiliate/page.tsx`.

Content ngắn (300 từ): legal-style nhưng vẫn đọc được. Cover:
- "Site này có liên kết affiliate" — định nghĩa.
- "Hoa hồng chúng tôi nhận" — % range chung (e.g. 1-8% tùy ngành).
- "Bạn KHÔNG phải trả thêm" — confirmed.
- "Chính sách tinh khiết" — không cookie stuffing, không clickjacking, không paid promotion disguised.
- Link tới chính sách bảo mật.

### AC6 — Liên hệ page

NEW file: `apps/web/app/lien-he/page.tsx`.

Form contact đơn giản (NEW component client):
- Họ tên
- Email
- Loại liên hệ: dropdown [Báo giá lỗi / Đề xuất sản phẩm / Hợp tác / Khác]
- Tin nhắn

Submit → POST `/api/v1/contact` → log + email (placeholder log only, real send sang sprint sau).

### AC7 — Sitemap update

File: `apps/web/app/sitemap.ts`.

Thêm vào sitemap:
- `/ve-chung-toi`
- `/tuyen-bo-affiliate`
- `/chinh-sach-bao-mat`
- `/dieu-khoan`
- `/lien-he`
- `/khuyen-mai` (STORY-06)
- `/deal-hot` (STORY-07)
- `/danh-muc` (NEW — all niches index, maybe defer)

Priority: about = 0.7, legal = 0.4, contact = 0.5.

### AC8 — Meta defaults

File: `apps/web/app/layout.tsx` `<Metadata>`.

Update default:
- title default: `{BRAND.name} — ${BRAND.taglineShort}`
- description default: `${BRAND.taglineLong}`
- ogImage default: `/og-default.png` (1200×630, NEW asset).

### AC9 — Tone audit (grep + fix)

Grep cho Vinglish phổ biến + fix:

```bash
grep -rn "vibe\|cool\|deal hunter\|siêu phẩm\|tuyệt vời\|xịn sò" apps/web/app apps/web/components
```

Tất cả match (trừ admin-only files) → rewrite:
- "siêu phẩm" → "đáng cân nhắc" / tên sản phẩm cụ thể
- "tuyệt vời" → "tốt" / "đáng tiền"
- "vibe" → bỏ
- "cool" → "đẹp" / "hiện đại"
- "deal hunter" → "người săn deal" / "team dealvault"
- "xịn sò" → "chất lượng cao"

Đồng thời check emoji: keep only 🔥 (hot), ⏰ (countdown), ✓ (verified), ★ (rating), 📧 (email), 🛒 (mua). Remove các emoji khác trừ trong admin UI.

### AC10 — Footer KHÔNG mention "Accesstrade" + grep guardrail

```bash
grep -rn "Accesstrade\|accesstrade" apps/web/app apps/web/components | grep -v "admin\|console\|comment"
```

Expect: chỉ admin files có match (admin operator cần biết). Public route copy = 0 match.

NEW script: `apps/web/scripts/check-public-copy.mjs`:

```js
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = ["Accesstrade", "accesstrade", "npm run", "db:reset", "localhost:"];
const ROOTS = ["app", "components"];
const SKIP = /(\/admin\/|\/api\/|\.test\.|\.spec\.|node_modules)/;

let failed = 0;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) {
      const content = readFileSync(p, "utf8");
      for (const word of FORBIDDEN) {
        // skip comments + import lines
        const lines = content.split("\n").map((l, i) => ({ l, i: i + 1 }))
          .filter(({l}) => !/^\s*(\/\/|\*)/.test(l) && !/^\s*import /.test(l));
        for (const {l, i} of lines) {
          if (l.includes(word)) {
            console.error(`[forbidden:${word}] ${p}:${i}: ${l.trim()}`);
            failed++;
          }
        }
      }
    }
  }
}
ROOTS.forEach(walk);
process.exit(failed > 0 ? 1 : 0);
```

Wire vào package.json script `check:public-copy`.

## Files touched

```
apps/web/lib/brand.ts                                          (NEW)
apps/web/components/layout/header.tsx                          (add tagline)
apps/web/components/layout/footer.tsx                          (rewrite cols + partner badges)
apps/web/app/ve-chung-toi/page.tsx                             (NEW)
apps/web/app/tuyen-bo-affiliate/page.tsx                       (NEW)
apps/web/app/lien-he/page.tsx                                  (NEW)
apps/web/app/lien-he/contact-form.tsx                          (NEW client)
apps/web/app/chinh-sach-bao-mat/page.tsx                       (NEW minimal)
apps/web/app/dieu-khoan/page.tsx                               (NEW minimal)
apps/web/app/layout.tsx                                        (update meta defaults)
apps/web/app/sitemap.ts                                        (add new routes)
apps/web/public/partners/{lazada,shopee,tiki,tiktok,nguyenkim}.svg (NEW assets)
apps/web/public/og-default.png                                 (NEW 1200×630)
apps/web/scripts/check-public-copy.mjs                         (NEW)
apps/web/package.json                                          (add check:public-copy script)
apps/api/src/modules/contact/contact.controller.ts             (NEW, placeholder)
```

## Verification

```bash
# 1. Grep public copy clean
node apps/web/scripts/check-public-copy.mjs
# expect: exit 0

# 2. Pages render
for path in /ve-chung-toi /tuyen-bo-affiliate /lien-he /chinh-sach-bao-mat /dieu-khoan; do
  curl -s -o /dev/null -w "$path = %{http_code}\n" http://localhost:3100$path
done
# expect: all 200

# 3. Sitemap
curl http://localhost:3100/sitemap.xml | grep -E "ve-chung-toi|tuyen-bo-affiliate"
# expect: matches

# 4. Footer screenshot
node scripts/screenshot-pages.mjs
# inspect footer in 01-home-desktop.png
# expect: partner badges row visible, no "Accesstrade" text, copyright với tagline

# 5. Meta defaults
curl -s http://localhost:3100/ | grep -E "<title>|og:title|og:description"
# expect: contains taglineShort

# 6. Tone audit
grep -rn "siêu phẩm\|tuyệt vời\|vibe" apps/web/app apps/web/components
# expect: 0 matches (or only inside /admin/ paths)
```

## Definition of done

- [ ] `brand.ts` centralized + used across header/footer/meta.
- [ ] Header có tagline dưới logo desktop.
- [ ] Footer 3 col rewrite + partner badges row + no Accesstrade mention.
- [ ] About page `/ve-chung-toi` rendered với 3 section + anchor link.
- [ ] Affiliate disclosure page exists.
- [ ] Contact page với form (placeholder backend OK).
- [ ] Sitemap + meta defaults updated.
- [ ] `check:public-copy` script pass.
- [ ] Tone audit clean (no Vinglish in public copy).

## Notes for next session

- Partner SVG logos cần ops upload thật (license check: dùng official press kit của từng brand).
- Brand rename → "DealHay" / "MuaKhôn" / "GiáTốt" là **separate ticket** business decision của owner.
- Contact form real backend send → email digest sprint hoặc dedicated CRM ticket.
- Policy pages (chinh-sach-bao-mat + dieu-khoan) cần legal review. Story này chỉ placeholder 200-300 từ.
- OG default image cần designer làm — placeholder 1200×630 brand-50 background với logo trung tâm là OK.
