#!/usr/bin/env node
/**
 * Design-system guards — "red acceptance test" cho Story 2-1 (đại tu trust-blue + AI-glow).
 *
 * Web KHÔNG có test framework (chỉ lint+build) → đây là grep-guard đo được, thay cho Jest.
 * Chạy:  node apps/web/scripts/design-guards.mjs
 * Exit 0 = tất cả AC pass (xanh). Exit 1 = còn vi phạm (đỏ).
 *
 * Tình trạng kỳ vọng KHI TẠO (trước dev): ĐỎ — bắt đúng hiện trạng "quê mùa".
 * Sau khi /bmad-dev-story 2-1 hoàn tất: phải XANH.
 *
 * SCOPE = storefront only. Admin (components/admin/**) cố tình NGOÀI scope (story 2-2).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(fileURLToPath(new URL("..", import.meta.url))); // apps/web
const rel = (p) => relative(WEB_ROOT, p).split(sep).join("/");

const TOKEN_FILES = ["tailwind.config.ts", "app/globals.css"].map((p) => join(WEB_ROOT, p));

// Storefront-scope: components/* nhưng LOẠI admin/**.
const COMPONENT_ROOTS = [
  "components/ui",
  "components/storefront",
  "components/layout",
  "components/article",
].map((p) => join(WEB_ROOT, p));
const COMPONENT_FILES_FLAT = [
  "components/product-card.tsx",
  "components/coupon-card.tsx",
  "components/product-detail-view.tsx",
  "components/navbar.tsx",
  "components/footer.tsx",
].map((p) => join(WEB_ROOT, p));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (full.split(sep).includes("admin")) continue; // skip admin
      walk(full, out);
    } else if (/\.(tsx?|css)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const storefrontFiles = [
  ...COMPONENT_ROOTS.flatMap((d) => walk(d)),
  ...COMPONENT_FILES_FLAT.filter(existsSync),
].filter((f) => !f.split(sep).includes("admin"));

const results = [];
const pass = (id, name) => results.push({ id, name, ok: true, hits: [] });
const fail = (id, name, hits) => results.push({ id, name, ok: false, hits });

function scan(files, regex) {
  const hits = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(regex);
      if (m) hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  return hits;
}

const tw = existsSync(TOKEN_FILES[0]) ? readFileSync(TOKEN_FILES[0], "utf8") : "";
const css = existsSync(TOKEN_FILES[1]) ? readFileSync(TOKEN_FILES[1], "utf8") : "";

// ── G1 (AC#1): primary-600/700 KHÔNG còn là Tailwind default ────────────
{
  const m600 = tw.match(/600:\s*"(#[0-9a-fA-F]{6})"/);
  const stillDefault =
    tw.includes('600: "#2563eb"') || tw.includes('700: "#1d4ed8"');
  stillDefault
    ? fail("G1", "Trust-blue custom thay default", [
        `tailwind.config.ts: primary-600/700 vẫn là #2563eb/#1d4ed8 (Tailwind default). primary-600 hiện = ${m600?.[1] ?? "?"}`,
      ])
    : pass("G1", "Trust-blue custom thay default");
}

// ── G2 (AC#2): 0 emoji-as-icon pictograph trong storefront ──────────────
// Block: 1F000–1FAFF (emoji/pictographs), 2600–26FF (misc symbols), 2B00–2BFF (⭐ stars/arrows),
//        1F1E6–1F1FF (flags). KHÔNG block 2700–27BF (✓ ✕ ✔ dingbat chức năng được giữ).
{
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}]/u;
  const hits = scan(storefrontFiles, emoji);
  hits.length ? fail("G2", "0 emoji-as-icon (storefront)", hits) : pass("G2", "0 emoji-as-icon (storefront)");
}

// ── G3 (AC#3): 0 arbitrary text-[..px] trong storefront ─────────────────
{
  const hits = scan(storefrontFiles, /text-\[[0-9.]+px\]/);
  hits.length ? fail("G3", "0 arbitrary text-[..px] (storefront)", hits) : pass("G3", "0 arbitrary text-[..px] (storefront)");
}

// ── G4 (AC#6): body font-weight 400 (không còn 500) ─────────────────────
{
  const bad = /body\s*\{[^}]*font-weight:\s*500/s.test(css);
  bad
    ? fail("G4", "body font-weight = 400", ["app/globals.css: body vẫn font-weight:500"])
    : pass("G4", "body font-weight = 400");
}

// ── G5 (AC#5): button atom KHÔNG dùng rounded-full (đã chuẩn hoá xl) ─────
{
  const btn = join(WEB_ROOT, "components/ui/button.tsx");
  if (existsSync(btn)) {
    const src = readFileSync(btn, "utf8");
    // BASE có thể định nghĩa đa dòng → bắt khối từ `const BASE =` tới dấu `;`.
    const baseBlock = src.match(/const\s+BASE\s*=([\s\S]*?);/)?.[1] ?? "";
    /rounded-full/.test(baseBlock)
      ? fail("G5", "button radius chuẩn hoá (không full)", [`ui/button.tsx BASE vẫn rounded-full: ${baseBlock.trim().slice(0, 90)}`])
      : pass("G5", "button radius chuẩn hoá (không full)");
  } else pass("G5", "button radius chuẩn hoá (không full)");
}

// ── G6 (AC#7): AI-glow signature tokens đã định nghĩa ───────────────────
{
  const hasGlow = /["']ai-glow["']\s*:/.test(tw) || /\bai-glow\b/.test(tw);
  const hasMesh = /["']ai-mesh["']\s*:/.test(tw) || /\bai-mesh\b/.test(tw);
  hasGlow && hasMesh
    ? pass("G6", "AI-glow/ai-mesh tokens định nghĩa")
    : fail("G6", "AI-glow/ai-mesh tokens định nghĩa", [
        `tailwind.config.ts: thiếu ${[!hasGlow && "boxShadow['ai-glow']", !hasMesh && "backgroundImage['ai-mesh']"].filter(Boolean).join(" + ")}`,
      ]);
}

// ── G7 (quyết định): ★ rating → Lucide Star, 0 ký tự ★ trong storefront ─
{
  const hits = scan(storefrontFiles, /★/);
  hits.length ? fail("G7", "★ rating → Lucide Star (0 ký tự ★)", hits) : pass("G7", "★ rating → Lucide Star (0 ký tự ★)");
}

// ── G8 (AC#9): trang listing áp width rộng (width="wide" hoặc max-w-7xl) ─
// Cơ chế `wide` đã có sẵn ở PageContainer (ui/section.tsx). AC = listing PHẢI dùng nó.
{
  // Chỉ trang grid rộng thật (home + category). deal-hot/[date] là feed 1-cột max-w-[480px] — KHÔNG widen.
  const listingPages = [
    "app/page.tsx",
    "app/categories/[slug]/page.tsx",
  ].map((p) => join(WEB_ROOT, p)).filter(existsSync);
  const usesWide = (f) => /width=["']wide["']|max-w-7xl/.test(readFileSync(f, "utf8"));
  const missing = listingPages.filter((f) => !usesWide(f)).map((f) => `${rel(f)}: chưa dùng width="wide"/max-w-7xl`);
  missing.length === 0 && listingPages.length > 0
    ? pass("G8", 'listing áp width="wide"')
    : fail("G8", 'listing áp width="wide"', missing.length ? missing : ["Không tìm thấy file listing page nào để kiểm"]);
}

// ── G9 (AC#1, edge): 0 hex xanh-default hardcode trong storefront ───────
// Token đổi không chạm hex cứng trong component (chart fill, inline style…) → phải gỡ.
{
  const blueHex = /#(2563eb|1d4ed8|3b82f6|60a5fa|1e40af)\b/i;
  const hits = scan(storefrontFiles, blueHex);
  hits.length
    ? fail("G9", "0 hex xanh-default hardcode (storefront)", hits)
    : pass("G9", "0 hex xanh-default hardcode (storefront)");
}

// ── Report ──────────────────────────────────────────────────────────────
let failed = 0;
console.log("\n=== Design-system guards — Story 2-1 ===\n");
for (const r of results) {
  console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  [${r.id}] ${r.name}`);
  if (!r.ok) {
    failed++;
    r.hits.slice(0, 12).forEach((h) => console.log(`        ↳ ${h}`));
    if (r.hits.length > 12) console.log(`        ↳ … +${r.hits.length - 12} chỗ nữa`);
  }
}
console.log(`\n${failed === 0 ? "🟢 ALL GREEN" : `🔴 ${failed}/${results.length} guard ĐỎ`} — storefront files scanned: ${storefrontFiles.length}\n`);
process.exit(failed === 0 ? 0 : 1);
