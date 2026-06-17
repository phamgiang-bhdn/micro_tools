# Accesstrade Publisher API — Tham chiếu tích hợp

Doc nội bộ cho AI agent + dev khi làm việc với Accesstrade trong repo này. Nguồn: doc chính thức publisher Accesstrade VN (cắt gọn về những phần dự án thực sự dùng).

> **Trạng thái triển khai**: chỉ endpoint `GET /v1/datafeeds` đang được code dùng ([accesstrade.client.ts](../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)). Các endpoint khác (campaigns, product_link/create, transactions) doc bên dưới là tham chiếu để sau mở rộng — chưa có client code.

---

## 1. Authentication

Mọi request gửi 2 header bắt buộc:

```
Authorization: Token <access_key>
Content-Type: application/json
```

Lưu ý format chính xác: **`Token` + dấu cách + access_key**. Không phải `Bearer`, không phải prefix khác.

- Lấy access key tại: `https://pub.accesstrade.vn/accounts/profile`
- Token là chuỗi opaque (~40-64 ký tự), không phải JWT, không có expiry rõ ràng — treat như password.
- Trong code: env `ACCESSTRADE_ACCESS_TOKEN` (lưu giá trị **thô**, không kèm prefix `Token`).
- Test nhanh:
  ```powershell
  curl.exe -i -H "Authorization: Token <key>" "https://api.accesstrade.vn/v1/datafeeds?page=1&limit=1"
  ```
  401 = token sai / chưa duyệt; 403 = chưa có quyền datafeed; 429 = rate-limit.

---

## 2. Base URL + env

| Env | Default | Mô tả |
|---|---|---|
| `ACCESSTRADE_API_BASE` | `https://api.accesstrade.vn/v1` | Base path. Không thêm `/v1` ở route. |
| `ACCESSTRADE_ACCESS_TOKEN` | — | Bắt buộc, lấy từ dashboard. |
| `ACCESSTRADE_PUBLISHER_ID` | — | Publisher ID (tab Profile). Token không decode ra ID, phải truyền riêng nếu cần. |

---

## 3. Endpoints

### 3.1. `GET /v1/datafeeds` — sản phẩm (đang dùng)

Pull danh sách offer/sản phẩm để upsert vào `Product`. Đây là endpoint duy nhất hiện tại code chạm tới.

**Query params** (tất cả optional):

| Param | Mô tả |
|---|---|
| `page` | Số trang, default 1, max = `total/limit`. |
| `limit` | Số sản phẩm/trang, default 50, **max 200**. |
| `campaign` | Lọc theo **merchant owner** (vd `lazada`, `shopeenew`) — chính là `c.merchant` từ `/v1/campaigns`. **KHÔNG nhận `campaign_id` numeric** (truyền vào trả mảng rỗng, im lặng — đây là pitfall đã từng cắn dự án; xem gotcha #3). 1 merchant có thể có nhiều campaign → param này gom hết offer của mọi campaign chung merchant. |
| `domain` | Lọc theo domain (vd `lazada.vn`, `shopee.vn`). |
| `price_from`, `price_to` | Khoảng giá gốc. |
| `discount_from`, `discount_to` | Khoảng giá sau khuyến mại. |
| `discount_amount_from`, `discount_amount_to` | Khoảng số tiền được giảm (VND). |
| `discount_rate_from`, `discount_rate_to` | Khoảng % được giảm. |
| `status_discount` | `0` = không khuyến mại, `1` = có khuyến mại. |
| `update_from`, `update_to` | Lọc theo thời gian update datafeed. **Format `DD-MM-YYYY`** (khác ISO). |

**Tận dụng filter server-side**: `AccesstradeClient.fetchProducts(opts)` truyền `campaign` (merchant slug), `domain` (1 only), `price_from/to`, `discount_from/to` (sale price), `discount_amount_from/to` (VND giảm), `discount_rate_from/to` (%), `status_discount`, `update_from/to` (DD-MM-YYYY) xuống `/v1/datafeeds`. `CrawlerService` chạy **per-assignment fetch** (sau khi nhận ra `?campaign=` chỉ nhận merchant slug): mỗi `CampaignCategory` = 1 fetch, push filterRules đã convert qua `rulesToFetchOpts()` ([crawler.service.ts](../../apps/api/src/modules/crawler/crawler.service.ts)) xuống AT. Limit 100/assignment (1 page), sleep 500ms giữa fetch. Offer route thẳng vào assignment's category — không cần name match, không cần first-match-wins. `domains` ≥2 vẫn filter client-side (AT chỉ hỗ trợ 1 domain/request).

**Response shape** (đã chuẩn hoá trong `AccesstradeProduct` interface — nhưng response thực tế phong phú hơn):
```ts
{
  id: string;            // → NormalizedOffer.externalId
  name: string;
  aff_link?: string;     // → affiliateUrl (ưu tiên)
  url?: string;          // fallback nếu aff_link rỗng
  image?: string;
  price?: number;
  sale_price?: number;   // nếu có → là giá bán hiện tại
  discount?: number;     // %, 0-100
  category?: string;     // free-text VN, dùng để infer categorySlug
  brand?: string;
  merchant?: string;     // → store + merchantName
  campaign?: string;     // tên chiến dịch (Accesstrade KHÔNG trả campaign_id ở endpoint này)
  desc?: string;
  // Các field thực tế còn có, code hiện chưa map:
  sku?: string;          // mã SKU merchant
  product_id?: string;   // id sản phẩm phía merchant (khác `id` AT — `id` là composite của AT)
  cate?: string;         // slug danh mục của AT (vd "thoi-trang-my-pham") — khác `category` (free text)
  discount_amount?: number; // VND đã giảm
  discount_rate?: number;   // % đã giảm (đáng tin hơn `discount`)
  status_discount?: 0 | 1;
  update_time?: string;     // format "DD-MM-YYYYTHH:mm:ss" (KHÔNG phải ISO chuẩn)
  promotion?: string | null;
}
```

**Quy ước chuẩn hoá**:
- `discountPercent`: ưu tiên `discount_rate`; fallback tính từ `(price - sale) / price` (`sale = sale_price ?? discount ?? price`).
- `currency`: hardcode `"VND"` (Accesstrade VN chỉ trả VND).
- `nicheSlug`: KHÔNG còn `inferNicheSlug` ở client; CrawlerService set từ `CampaignNiche` assignment (deterministic). Web-scrape (paste URL tay) vẫn dùng `inferNicheSlug` qua `WebScrapeClient`.

**Gotcha quan trọng**:
- Endpoint trả **mọi campaign đã duyệt** của publisher (khi không truyền `campaign`). Per-merchant mode: pull `?campaign=<merchantSlug>` 1 lần/merchant rồi route client-side về Campaign bằng `offer.campaign === campaign.name`.
- `aff_link` được Accesstrade sinh theo publisher → **không stable cross-publisher**, nhưng stable across calls cho cùng publisher. Dedup theo `affiliateUrl` ở [import.service.ts](../../apps/api/src/modules/crawler/import.service.ts) là an toàn.
- Path chính upsert `Campaign` theo `atCampaignId` thật từ `/v1/campaigns`. `resolveCampaignId` (legacy, slug-based `externalId`) chỉ còn fallback cho web-scrape (paste URL tay).

---

### 3.2. `GET /v1/campaigns` — danh sách campaign (đang dùng)

Liệt kê chiến dịch publisher đã hoặc chưa đăng ký. Hữu ích để **build danh sách merchant** trước khi pull datafeed (vd cần biết campaign_id cụ thể để chỉ pull subset).

**Query params**:
- `approval=successful` — lọc campaign đã duyệt (campaign của tôi).
- `campaign_id=<id>` — lấy chi tiết 1 campaign.
- `page`, `limit` — phân trang.

**Response fields đáng chú ý**:
- `data.id` — campaign_id thật (string số dài, vd `"5585194803623188142"`).
- `data.name`, `data.merchant`, `data.logo`, `data.url`.
- `data.approval`: `unregistered | pending | successful`.
- `data.status`: `1` = Running.
- `data.cookie_duration` (seconds), `data.cookie_policy`.
- `data.description` — object lồng (HTML): `action_point`, `commission_policy`, `cookie_policy`, `introduction`, `other_notice`, `rejected_reason`, `traffic_building_policy`. **HTML thô**, cần strip nếu hiển thị.
- `data.start_time`, `data.end_time` (ISO; end có thể null).
- `data.scope`: `public | private`.

**Khi nào dùng**:
- Lấy `campaign_id` để truyền vào endpoint `product_link/create` (mục 3.4).
- Sync trạng thái duyệt vào `Campaign.status` thay vì gõ tay.

**Triển khai trong repo**: `AccesstradeClient.fetchCampaigns({ approval, page, limit })` + `CampaignSyncService.syncFromAccesstrade()` (upsert theo `Campaign.atCampaignId`, không đụng admin-managed fields: `categoryId`, `filterRules`, `notes`). Trigger thủ công qua `POST /api/v1/admin/campaigns/sync-from-at` (role `admin`) hoặc nút "Sync from Accesstrade" trên `/admin/campaigns`.

---

### 3.3. `GET /v1/cashback/campaigns` — campaign với commission đã chuẩn hoá (chưa dùng)

Phiên bản mới, trả thêm thông tin **hoa hồng** đã normalize. Dùng khi muốn rank campaign theo mức commission để chọn merchant ưu tiên.

**Query params**:
- `page`, `page_size` (default page=1).
- `category_id` — lọc theo ngành hàng.
- `sort_by`: `min_commission | max_commission`.
- `sort_order`: `asc | desc`.
- `sort_by_category`: `true | false`.

**Response shape**:
```ts
{
  status: "success",
  data: {
    campaigns: [{
      campaign_id: string,
      name: string,
      logo: string,
      merchant: string,                // domain merchant
      url: string,
      status: "1",                     // running
      approval: "successful",
      scope: "public" | "private",
      cookie_expire: number,           // seconds
      min_commission: number,
      max_commission: number,
      commission_type: "percentage" | "fixed",
      category_id: string,
      category_name: string,
      sub_category: string,
      all_commissions: [{              // breakdown theo sub-category
        id, min_commission, max_commission,
        commission_type, category_id, category_name,
        is_default: boolean
      }],
      description: { /* HTML, giống mục 3.2 */ },
      gross_commission: number,        // tổng hoa hồng đã nhận?
      start_date, end_date,
      type: number,
      adv_code: string                 // merchant code
    }],
    meta: { per_page, current_page, total }
  },
  message: "Success",
  code: "PX00000"
}
```

**Khác biệt vs `/v1/campaigns`**: có `min/max_commission` + `all_commissions` breakdown. Wrap response trong `data.campaigns` (không phải `data` thẳng). Có meta pagination tử tế hơn.

---

### 3.4. `POST /v1/product_link/create` — tạo tracking link (chưa dùng)

Dự án hiện tại **không gọi endpoint này** — ta dùng `aff_link` có sẵn trong datafeed. Cần khi:
- Tạo link cho URL bất kỳ (không phải sản phẩm trong feed).
- Cần gắn UTM tuỳ chỉnh (utm_source, sub1-4...) để tracking nội bộ.

**Body** (JSON):
```json
{
  "campaign_id": "4348614231480407268",
  "urls": ["https://shopee.vn/m/ma-giam-gia"],
  "utm_source": "test_source",
  "utm_medium": "test_medium",
  "utm_campaign": "test_campaign",
  "utm_content": "test_content",
  "sub1": "...", "sub2": "...", "sub3": "...", "sub4": "...",
  "url_enc": true
}
```

- `campaign_id` bắt buộc; `urls` optional (nếu thiếu thì dùng URL gốc của campaign).
- Truyền `urls` dạng array, nhiều URL được.

**Response**:
```ts
{
  success: true,
  data: {
    success_link: [{
      aff_link: string,      // link tracking đầy đủ (deep_link/<pub_id>/<campaign_id>?...)
      first_link: string | null,
      short_link: string,    // shorten.dev.accesstrade.me/<code>
      url_origin: string
    }],
    error_link: [],
    suspend_url: []
  }
}
```

**Lưu ý nếu sau này tích hợp**:
- Nên cache `aff_link` theo `(campaign_id, url_origin, utm_set)` vào DB — đừng gọi lại mỗi click.
- `suspend_url`: URL bị Accesstrade chặn (merchant không cho deep-link). Phải skip ở storefront.

---

### 3.5. `GET /v1/transactions` — danh sách giao dịch / conversion (chưa dùng)

**Rate limit: 10 request / phút** — cần backoff cẩn thận.

Mục đích: **reconcile conversion** từ phía Accesstrade với `ConversionWebhook` đã nhận. Webhook có thể miss/late → poll endpoint này định kỳ là cơ chế "ground truth" để không thất thoát hoa hồng.

**Query params**:
- `since` (bắt buộc), `until` (bắt buộc) — ISO format, theo **sale time**. Vd `"2026-01-01T00:00:00Z"`.
- `update_time_start`, `update_time_end` — variant theo update time (dùng cho incremental sync).
- `page`, `offset`, `limit` (default 100).
- `merchant`, `utm_source`, `utm_campaign`, `utm_medium`, `utm_content` — filter.
- `status`: `0` hold | `1` approved | `2` rejected.
- `is_confirmed`: `0` chưa duyệt | `1` đã duyệt. (Nếu truyền `is_confirmed` mà không có `status` → mặc định `status=1`.)
- `transaction_id` — filter 1 hoặc nhiều (comma-separated).
- `is_brand_bonus`: `true | false`.

**Response fields chính**:
```ts
{
  id: string,                    // transaction primary key của AT
  transaction_id: string,        // order id phía merchant
  conversion_id: number,
  status: 0 | 1 | 2,             // hold/approved/rejected
  is_confirmed: 0 | 1,
  merchant: string,              // vd "shopee"
  click_time, transaction_time, update_time, confirmed_time,   // ISO
  transaction_value: number,
  commission: number,            // hoa hồng publisher nhận
  product_id, product_name, product_price, product_quantity, product_image, product_category, category_name,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  click_url: string,
  conversion_platform: "website" | ...,
  customer_type: string,
  is_brand_bonus: boolean,
  reason_rejected: string,
  _extra: {                      // device/browser của click
    device, device_type, device_brand, device_family, device_model,
    os, browser,
    parameters: { at_unique_id, click_url, click_user_agent, utm_tool }
  }
}
```

**Map vào schema dự án** (chưa implement, đây là gợi ý):
- `utm_source` của AT = `trackingCode` của ta (vì web action `createTrackingRedirect()` ghi `utm_source=<trackingCode>`).
- → có thể join `transactions.utm_source` ↔ `ClickLog.trackingCode` ↔ `ConversionWebhook.trackingCode` để 3 phía khớp.
- `transaction_id` ↔ `ConversionWebhook.transactionId` (nếu webhook đã có row, chỉ update; nếu chưa, tạo mới).

**Rate-limit strategy** (khi implement):
- Poll mỗi 5-10 phút, query `update_time_start = (last_sync - 5m)` để bắt cả những giao dịch vừa update status. Lưu `last_sync` trong DB.
- Dùng `is_confirmed=0` query riêng để track pending vs approved.
- Wrap retry 429 cùng style với `AiService` (exponential backoff).

---

### 3.6. `GET /v1/order-list` — danh sách đơn hàng v2 (đang dùng)

**Rate limit: 10 req/phút. Cache phía AT 1 phút** — đừng spam.

Khác `/v1/transactions` (mục 3.5) ở chỗ **đơn vị là đơn hàng**, không phải dòng sản phẩm. Một order có thể chứa nhiều product → muốn xem từng product phải gọi tiếp `/v1/order-products` (mục 3.7).

**Query params**:
- `since`, `until` — bắt buộc, ISO format.
- `page` (default 1), `limit` (default 30, **max 300** — quá 300 bị set về 300).
- `utm_source`, `utm_campaign`, `utm_medium`, `utm_content` — filter.
- `status`: `0` hold | `1` approved | `2` rejected.
- `merchant`: vd `adayroi`, `lazada`, `shopee_kolnew`.

**Response shape**:
```ts
{
  data: [{
    order_id: string,              // ID đơn hàng phía merchant
    merchant: string,
    billing: number,               // tổng giá trị đơn (VND)
    pub_commission: number,        // hoa hồng cho publisher
    products_count: number,
    order_approved: number,        // số item ở trạng thái approved
    order_pending: number,
    order_reject: number,
    is_confirmed: 0 | 1,
    sales_time, click_time, confirmed_time, update_time,   // ISO
    at_product_link: string,       // link tracking cuối cùng
    landing_page: string,
    website: string,
    website_url: string,
    client_platform: "mobile" | "pc" | ...,
    browser: string,
    category_name: string,
    product_category: string,      // VN slug, vd "Phu_Kien_Thoi_Trang"
    conversion_platform: string | null,
    customer_type: string | null,
    utm_source, utm_medium, utm_campaign, utm_content
  }],
  total: number
}
```

**Khi nào dùng `order-list` vs `transactions`** (cả hai cùng mục đích reconcile):
- `order-list` → báo cáo doanh thu theo đơn (KPI hiển thị admin: "20 đơn hôm nay, 5tr commission").
- `transactions` → tracking từng dòng sản phẩm, ghép với `_extra` device info. Dùng khi cần phân tích sâu (top product, device split).
- Đề xuất pipeline: poll `order-list` định kỳ (rẻ hơn) → khi thấy `order_pending > 0` mới gọi `order-products` để lấy chi tiết. Đừng gọi cả hai cho mọi đơn.

---

### 3.7. `GET /v1/order-products` — sản phẩm trong 1 đơn hàng (chưa dùng)

**Rate limit: 10 req/phút.**

Lấy chi tiết từng sản phẩm trong 1 order — kèm breakdown trạng thái (approved/pending/reject) ở **cấp item**, không phải order.

**Query params**:
- `order_id` (bắt buộc) — lấy từ `/v1/order-list` mục 3.6.
- `merchant` (bắt buộc) — vd `lazada_cashback`.
- `page`, `limit` (optional).

**Response shape**:
```ts
{
  data: [{
    _id: string,                   // composite id của AT
    campaign_id: string,           // ID campaign thật (number string)
    merchant: string,
    product_price: number,
    product_quantity: number,
    quantity: { approved: number, pending: number, reject: number },
    billing:   { approved: number, pending: number, reject: number },   // giá đã trừ discount
    commission:{ approved: number, pending: number, reject: number },
    reason_rejected: string,
    sales_time, click_time, confirmed_time,
    _at: {                         // tracking metadata
      banner_id, commission_type, goods_id, result_id, reward_type, seq_no, vn_click_id
    },
    _extra: {                      // device + UA của click
      browser, device, device_brand, device_family, device_model, device_type, os,
      parameters: { at_unique_id, click_url, click_user_agent, utm_campaign, utm_source, utm_tool }
    }
  }],
  total: number
}
```

**Quan trọng**: `billing/commission/quantity` ở đây là **object 3 trạng thái**, không phải scalar — sản phẩm có thể có 5 quantity, 2 approved, 1 pending, 2 reject. Đừng dùng `commission.approved + .pending` làm doanh thu — chỉ `.approved` mới chắc chắn nhận.

**Đây cũng là endpoint duy nhất trả `campaign_id` thật** ở cấp sản phẩm — hữu ích khi cần link Product trong `/v1/datafeeds` (chỉ có `campaign` string) với Campaign trong `/v1/campaigns` (có `id` số).

---

### 3.8. `GET /v1/product_detail` — chi tiết sản phẩm theo order (chưa dùng)

Lấy thông tin marketing của sản phẩm (tên, giá, mô tả, ảnh) — dùng khi `/v1/order-products` chỉ trả ID và bạn cần name/image để hiển thị.

**Query params (tất cả bắt buộc)**:
- `merchant` — vd `fpt_longchau`, `lazada`.
- `product_id` — id phía merchant.
- `transaction_id` — mã giao dịch (lấy từ `/v1/transactions` hoặc `/v1/order-products._id`).

**Response shape**:
```ts
{
  name: string,
  price: number,                   // giá gốc
  discount: number,                // giá sau khuyến mại (KHÔNG phải %!)
  short_desc: string,
  desc: string,                    // mô tả đầy đủ, thường rất dài
  link: string,                    // URL sản phẩm gốc
  image: string,
  category_id: string,
  category_name: string,
  brand: string,
  shop_id: string,
  shop_name: string
}
```

**Gotcha**: ở endpoint này `discount` = **giá tiền sau giảm (VND)**, không phải `%`. Khác với `/v1/datafeeds` nơi có cả `discount` (giá) và `discount_rate` (%). Đọc nhầm là lệch UI.

---

### 3.9. `GET /v1/offers_informations/*` — vouchers/coupons (đang dùng)

Nhóm endpoint về **mã khuyến mại** (voucher code), tách biệt khỏi datafeed sản phẩm. Có giá trị riêng cho hoạt động coupon-aggregator (vd `/khuyen-mai/shopee`).

**3.9.1. `GET /v1/offers_informations/merchant_list`** — danh sách nhà cung cấp có voucher.
```ts
{ data: [{ id, display_name, login_name, logo, total_offer }], success: true }
```

**3.9.2. `GET /v1/offers_informations/keyword_list`** — từ khoá hot.
```ts
{ data: [{ id, icon_text, total_offer }], success: true }
// id format: "<merchant>-<keyword_id>", vd "shopee-181427514064896"
```

**3.9.3. `GET /v1/offers_informations/icontext_list?merchant=<id>`** — keywords theo merchant.

**3.9.4. `GET /v1/offers_informations/coupon?icon_text=<id>&limit=<n>`** — vouchers theo keyword.
```ts
{
  id, name, content, image, link, prod_link,
  merchant, categories, domain,
  start_time, end_time,
  banners: [{ link, width, height }],
  coupons: [...],                  // mã giảm cụ thể
  coin_cap, coin_percentage, percentage_used,
  discount_value, discount_percentage
}
```

**3.9.5. `GET /v1/offers_informations/list_category_coupons`** — phân nhóm voucher theo ngành (`E-COMMERCE`, `BEAUTY`, ...).

**3.9.6. `GET /v1/offers_informations` (legacy, deprecated)** — AT khuyến nghị dùng `/coupon` mới. Schema khác chút (`aff_link` thay `prod_link`). Đừng triển khai mới với endpoint này.

**Map vào schema**: dự án có model `Coupon` ([prisma/schema.prisma](../../apps/api/prisma/schema.prisma) — đã có ở migration `20260515130000_add_coupons_crawlerlogs_category_seo`). Khi onboard, một `offers_informations/coupon.id` → 1 row `Coupon`; `merchant` → join về `Campaign.merchantName`.

---

### 3.10. `GET /v1/top_products` — top sản phẩm bán chạy (đang dùng)

Lấy top 50 product theo doanh thu trong khoảng thời gian. Dùng cho "bảng xếp hạng" / "top 10 must-buy" trên storefront.

**Query params**:
- `date_from`, `date_to` — format `DD-MM-YYYY` (khác ISO, **khác `/v1/datafeeds.update_*`** chỗ separator).
- `merchant` — optional, vd `lazada`.

**Response shape**:
```ts
{
  data: [{
    product_id, name, brand, image, link, aff_link,
    category_id, category_name, product_category,
    price, discount,                // discount = giá sau giảm (VND)
    short_desc, desc
  }],
  total: number
}
```

Tốt cho UI homepage. Nhược: doc không nói total bao nhiêu / pagination ra sao — mặc định 50 row.

---

### 3.11. Coupon widget embed (HTML script, không phải API)

AT cung cấp 1 **`<script>` widget** tự render danh sách deal/coupon — KHÔNG cần code backend, chỉ paste HTML vào trang web. Mã nhúng đầy đủ trong doc gốc; phần cần customize:

```html
<script type="text/javascript" id="atScript6626"
  data-accesskey="4348611760548105593"      <!-- pubID, lấy từ pub2.accesstrade.vn/tool/deep_link -->
  data-utm-source=""  data-utm-medium=""  data-utm-campaign=""  data-utm-content=""
  data-sub1=""  data-sub2=""  data-sub3=""  data-sub4=""  data-sub5=""
  data-filters='{}'
  src="https://static.accesstrade.vn/coupon/v2/js/main.js"></script>
```

**Gotcha**:
- `data-accesskey` ≠ access token API! Đây là **publisher ID** (chuỗi số ~19 chữ số), lấy ở https://pub2.accesstrade.vn/tool/deep_link → đoạn cuối URL `deep_link/<pubID>/`.
- WP Rocket / plugin nén CSS-JS sẽ **break widget** — phải whitelist hoặc tắt cho route đó.
- Encode UTF-8 trước khi truyền `data-utm-*` (vd dấu cách → `%20`).
- Widget chèn cả jQuery 1.11 + Bootstrap CSS riêng → **xung đột style/JS** trên trang đã có Bootstrap/jQuery khác. Cách an toàn: nhúng trong `<iframe>`.

**Khi nào nên dùng vs tự gọi `/v1/offers_informations/coupon`**:
- Dùng widget: prototype/landing nhanh, không cần tuỳ biến UI, không cần SEO (script render client-side, Google không index tốt).
- Tự gọi API + render SSR: storefront chính của dự án này (Next.js RSC) — phải tự gọi API để có SEO + nhất quán style.

---

## 4. Error codes (chung tất cả endpoint)

| HTTP | Ý nghĩa |
|---|---|
| 400 | Bad Request — query params sai/thiếu |
| 401 | Unauthorized — token sai, hết hạn, hoặc thiếu prefix `Token ` |
| 403 | Forbidden — token đúng nhưng không có quyền (chưa duyệt campaign / chưa đủ tier) |
| 404 | Not Found — endpoint sai hoặc resource không tồn tại |
| 405 | Method Not Allowed — dùng `POST` cho endpoint `GET` (hoặc ngược lại) |
| 429 | Rate-limit (chỉ thấy doc note ở `/transactions` + `/order-list` + `/order-products`, nhưng cẩn thận ở mọi endpoint) |

---

## 5. Mapping sang code hiện tại

| Concept Accesstrade | Field/Entity trong repo |
|---|---|
| `id` (product) | `Product.scrapedData.sourceId` (lưu trong JSON, không phải column) |
| `aff_link` | `Product.affiliateUrl` (dedup key) |
| `campaign` (string ở `/v1/datafeeds`) | `Campaign.name` (slug-based `externalId` là legacy, `@deprecated` — code mới join qua `atCampaignId`) |
| `campaigns.id` (từ `/v1/campaigns`) | `Campaign.atCampaignId` (khoá ổn định, set bởi `CampaignSyncService`) |
| `campaigns.{category,sub_category,logo,merchant,scope,cookie_duration,start_time,end_time}` | `Campaign.{atCategoryName, atSubCategory, atLogo, merchantName, atScope, atCookieDurationSec, atStartTime, atEndTime}`; raw response → `Campaign.atRawData` |
| `merchant` | `Campaign.merchantName`, `Product.scrapedData.store` |
| `transactions` row | (chưa onboard — reconcile dùng `/v1/order-list` thay) |
| `_extra.parameters.utm_source` | `ClickLog.trackingCode` |
| `order-list.order_id` | `ConversionWebhook.atOrderId` (đối soát theo đơn, set bởi `ReconciliationService`) |
| `order-list.pub_commission` | `ConversionWebhook.atCommission` — so sánh với `revenue` để phát hiện mismatch |
| `order-list.utm_source` | Match `ConversionWebhook.trackingCode` để link order với click |
| `order-products.campaign_id` | Nguồn duy nhất có `campaign_id` thật cấp product → có thể backfill `Campaign.atCampaignId` |
| `offers_informations/coupon.id` | `Coupon.atCouponId` (unique). `code` field set = `atCouponId` cho mã sync (admin tự nhập có thể đặt code thật). |
| `offers_informations/coupon.content` | `Coupon.contentHtml` — đã **sanitize** server-side qua `sanitize-html` util trước khi save. |
| `offers_informations/merchant_list.login_name` | `Coupon.merchantSlug` (dùng làm public route `/khuyen-mai/<merchantSlug>`) |
| `top_products.product_id` | `TopProductSnapshot.atProductId` (snapshot per day) |
| `top_products.aff_link` | `TopProductSnapshot.affLink` (link card thẳng ra, không qua ClickLog) |
| `top_products.discount` | `TopProductSnapshot.discount` — VND, KHÔNG phải % |
| Coupon widget `data-accesskey` | = publisher ID, **không phải** access token (đừng paste nhầm token vào HTML public!) |

---

## 6. Gotcha tổng hợp

1. **Header sai format → 401**. Phải đúng `Authorization: Token <key>`, không phải `Token: <key>` hoặc `Bearer <key>`.
2. **Datafeed trả mọi campaign approved** khi không truyền `campaign`. Crawler-cycle dùng **per-merchant fetch + per-campaign routing**: group `Campaign` (status=APPROVED + có `atCampaignId` + `merchantName` + ≥1 assignment) theo merchant → 1 fetch `?campaign=<merchantSlug>` / merchant (paginate `limit=200`, cap 10 pages) → mỗi offer route về Campaign khớp bằng `offer.campaign === campaign.name`. `inferCategorySlug` (client-side) chỉ còn dùng cho path web-scrape paste URL — không đụng crawler-cycle.
3. **`campaign` ở `/v1/datafeeds` cực kỳ ambiguous, đọc kỹ**:
   - **Query param `?campaign=`** = **merchant slug** (vd `shopee`, `lazada`, `tikivn`). Truyền `campaign_id` numeric (vd `"5585194803623188142"`) → AT trả mảng rỗng (không lỗi rõ ràng → bug âm thầm). Lấy slug từ `c.merchant` ở `/v1/campaigns` response.
   - **Response field `.campaign`** = **tên hiển thị của campaign** (string, không phải ID). Khớp với `c.name` ở `/v1/campaigns`. Dùng để dedup offer về đúng Campaign khi 1 merchant có nhiều campaign.
   - **Endpoint này KHÔNG trả campaign_id numeric** ở response. Muốn lấy id thật cấp product phải qua `/v1/order-products` (mục 3.7).
   - Đừng confuse 3 thứ trên với `c.id` ở `/v1/campaigns` (numeric string `"5585194803623188142"`).
4. **HTML trong `description.*`**: tất cả là HTML thô có inline style. Khi xử lý bằng AI / hiển thị, **strip HTML** trước (vd `cheerio` hoặc regex đơn giản) — đừng render thẳng, lộ style merchant.
5. **Rate limit `/v1/transactions` = 10 req/phút**. Endpoint khác doc không nói rõ, nhưng giữ chung mức < 30 req/phút cho tất cả endpoint Accesstrade là an toàn.
6. **Status code conversion**:
   - `0` = pending/hold (có thể bị reject sau)
   - `1` = approved (hoa hồng chắc chắn nhận)
   - `2` = rejected (đã huỷ, không thanh toán)
   Khi reconcile, **không tính revenue cho status=0**; chỉ count `1`.
7. **`is_brand_bonus = true`**: là khoản thưởng riêng, không phải hoa hồng từ order. Tách khi report.
8. **Time zone**: ISO format thường là UTC (`...Z`). Nếu thấy ISO không có `Z`, mặc định Accesstrade dùng `Asia/Ho_Chi_Minh`. Luôn check trước khi so sánh với `ClickLog.createdAt`.
9. **Date format không nhất quán giữa endpoints**:
   - `/v1/transactions`, `/v1/order-list`: ISO 8601 chuẩn (`2026-01-01T00:00:00Z`).
   - `/v1/datafeeds` query `update_from/to`: format `DD-MM-YYYY` (vd `08-09-2017`).
   - `/v1/datafeeds` response `update_time`: format lai `DD-MM-YYYYTHH:mm:ss` (KHÔNG phải ISO).
   - `/v1/top_products` query `date_from/to`: `DD-MM-YYYY`.
   → Đừng dùng chung helper format date. Mỗi endpoint phải có converter riêng (hoặc viết helper `toAtDateFormat(date, "iso" | "dmy" | "dmyt")`).
10. **`discount` ambiguous**:
    - `/v1/datafeeds.discount` = giá sau giảm (VND). `discount_rate` = % giảm.
    - `/v1/product_detail.discount` = giá sau giảm (VND), không có `discount_rate`.
    - `/v1/top_products.discount` = giá sau giảm (VND).
    - `AccesstradeClient.toNormalized` đọc `discount_rate` cho `discountPercent`; `discount` được dùng làm fallback giá sau giảm (`sale = sale_price ?? discount ?? price`), không còn xem như %.
11. **Order vs transaction vs product**: 3 đơn vị khác nhau — đừng confuse:
    - `/v1/order-list` → **order** (1 đơn = nhiều product, có `order_id`).
    - `/v1/order-products` → **product line trong order** (breakdown 3 trạng thái approved/pending/reject ở cấp item).
    - `/v1/transactions` → **conversion line** (1 dòng = 1 product, status scalar 0/1/2).
    Cùng 1 sự kiện mua hàng xuất hiện ở cả 3 endpoint với shape khác nhau.

---

## 7. Khi mở rộng — checklist

Nếu thêm endpoint mới (vd `transactions` poller):
1. Thêm method vào `AccesstradeClient` (giữ pattern `fetch` + try/catch + log; trả empty array khi fail).
2. Nếu là cron job riêng → tạo service mới trong `apps/api/src/modules/crawler/` hoặc module mới (vd `reconciliation/`).
3. Update env example + doc env trong [apps/api/CLAUDE.md](../../apps/api/CLAUDE.md) phần "Env".
4. Update doc này: ghi rõ endpoint mới vào trạng thái "đang dùng".
5. Nếu cần persist data mới (vd campaign_id thật) → migration Prisma; **không** dùng field trong `scrapedData` Json — vì cần index/query.
