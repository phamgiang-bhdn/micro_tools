#!/usr/bin/env node
/**
 * Guards "red test" cho Story 3-1 (Trang chủ AI-first). Web không có test framework → grep-guard.
 * Chạy: node apps/web/scripts/home-ai-first-guards.mjs
 * Exit 0 = pass hết. Exit 1 = còn đỏ.
 *
 * Trước dev: H1-H3 ĐỎ (bắt hiện trạng), H4 XANH (invariant phải giữ).
 * Sau /bmad-dev-story 3-1: tất cả XANH.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => (existsSync(join(WEB, p)) ? readFileSync(join(WEB, p), "utf8") : "");

const page = read("app/page.tsx");
const grid = read("components/storefront/curated-niche-grid.tsx");

const results = [];
const add = (id, name, ok, note) => results.push({ id, name, ok, note });

// ── H1 (AC4): curated-niche-grid KHÔNG còn "Đang cập nhật" (đã reframe) ──
add(
  "H1",
  'curated-niche-grid bỏ "Đang cập nhật" (→ lời hứa)',
  grid !== "" && !grid.includes("Đang cập nhật"),
  'còn chuỗi "Đang cập nhật" trong curated-niche-grid.tsx'
);

// ── H2 (AC2): home render dải bằng chứng (TrustStrip/SocialProofStrip) ──
const hasProof = /TrustStrip|SocialProofStrip|trust-strip|social-proof-strip/.test(page);
add("H2", "home có dải bằng chứng dưới hero (tái dùng trust/social-proof)", hasProof, "page.tsx chưa render TrustStrip/SocialProofStrip");

// ── H3 (AC1): khối lỗi "bảo trì" KHÔNG nằm TRÊN section danh mục ──
// Pass nếu: cụm "bảo trì" đã bỏ, HOẶC vị trí của nó nằm SAU mốc #all-deals (đã dời vào khu grid).
{
  const errIdx = page.indexOf("đang bảo trì");
  const dealsIdx = page.search(/id="all-deals"|#all-deals/);
  const ok = errIdx === -1 || (dealsIdx !== -1 && errIdx > dealsIdx);
  add("H3", "lỗi tải KHÔNG còn là banner top-level trên danh mục", ok,
    "khối 'đang bảo trì' vẫn nằm trên khu #all-deals (chiếm spotlight đầu trang)");
}

// ── H5 (AC2 edge): dải bằng chứng nằm KHU TRÊN (trước #all-deals) → luôn hiện ──
// Chặn case đặt TrustStrip trong nhánh loadError khiến nó biến mất khi lỗi.
{
  const proofIdx = page.search(/TrustStrip|SocialProofStrip/);
  const dealsIdx = page.search(/id="all-deals"|#all-deals/);
  const ok = proofIdx !== -1 && dealsIdx !== -1 && proofIdx < dealsIdx;
  add("H5", "dải bằng chứng ở khu trên (luôn hiện, kể cả khi lỗi)", ok,
    "TrustStrip/SocialProofStrip chưa đặt ở khu trên #all-deals (có thể bị ẩn khi loadError)");
}

// ── H4 (AC5 invariant — phải GIỮ XANH): empty-vs-error vẫn tách ──
// page.tsx phải còn dùng `loadError` VÀ một nhánh rỗng riêng `!loadError && ... length === 0`.
{
  const keepsError = /\bloadError\b/.test(page);
  const keepsEmpty = /!loadError\s*&&[^?]*length === 0/.test(page) || /sorted\.length === 0/.test(page);
  add("H4", "[invariant] giữ phân biệt empty-vs-error (story 1-4)", keepsError && keepsEmpty,
    "MẤT phân biệt loadError vs rỗng-hợp-lệ — vi phạm story 1-4");
}

// ── Report ──
let failed = 0;
console.log("\n=== Guards — Story 3-1 (Trang chủ AI-first) ===\n");
for (const r of results) {
  console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  [${r.id}] ${r.name}`);
  if (!r.ok) { failed++; console.log(`        ↳ ${r.note}`); }
}
const invariant = results.find((r) => r.id === "H4");
console.log(
  `\n${failed === 0 ? "🟢 ALL GREEN" : `🔴 ${failed}/${results.length} ĐỎ`}` +
  `${invariant && !invariant.ok ? "  ⚠️ H4 invariant GÃY — dừng ngay" : ""}\n`
);
process.exit(failed === 0 ? 0 : 1);
