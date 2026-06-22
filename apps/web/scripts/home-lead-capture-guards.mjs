#!/usr/bin/env node
/**
 * Guards "red test" cho Story 3-2 (Lead-capture home empty-state). Web không có framework → grep-guard.
 * Chạy: node apps/web/scripts/home-lead-capture-guards.mjs
 * Trước dev: S1-S4 ĐỎ. Sau /bmad-dev-story 3-2: tất cả XANH (+ design-guards 9/9 + home-ai-first 5/5).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => (existsSync(join(WEB, p)) ? readFileSync(join(WEB, p), "utf8") : "");

const form = read("components/storefront/subscribe-form.tsx");
const page = read("app/page.tsx");
const modal = read("components/storefront/subscribe-modal.tsx");

const results = [];
const add = (id, name, ok, note) => results.push({ id, name, ok, note });

// ── S1 (AC6): component chia sẻ subscribe-form.tsx tồn tại + submit /api/subscribe + honeypot ──
add(
  "S1",
  "subscribe-form.tsx (chia sẻ) — POST /api/subscribe + honeypot",
  form !== "" && /\/api\/subscribe/.test(form) && /honeypot|honeyPot/i.test(form),
  "thiếu subscribe-form.tsx HOẶC chưa POST /api/subscribe HOẶC thiếu honeypot"
);

// ── S2 (AC1): home render SubscribeForm ──
add("S2", "home (page.tsx) render SubscribeForm", /SubscribeForm/.test(page), "page.tsx chưa render SubscribeForm");

// ── S3 (AC1+invariant): SubscribeForm nằm Ở NHÁNH EMPTY (sau mốc empty), không nhánh error ──
{
  const useIdx = page.lastIndexOf("SubscribeForm"); // usage (không phải import)
  const emptyIdx = page.indexOf("!loadError && sorted.length === 0");
  const ok = useIdx !== -1 && emptyIdx !== -1 && useIdx > emptyIdx;
  add("S3", "SubscribeForm ở nhánh empty (sau !loadError && length===0)", ok,
    "SubscribeForm chưa đặt trong nhánh empty hợp lệ (coi chừng lọt nhánh loadError)");
}

// ── S4 (AC6 reuse): subscribe-modal DÙNG LẠI SubscribeForm (không copy logic) ──
add("S4", "subscribe-modal tái dùng SubscribeForm (không duplicate)",
  modal !== "" && /SubscribeForm|subscribe-form/.test(modal),
  "subscribe-modal chưa import/tái dùng SubscribeForm → logic bị nhân đôi");

// ── Report ──
let failed = 0;
console.log("\n=== Guards — Story 3-2 (Lead-capture home empty) ===\n");
for (const r of results) {
  console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  [${r.id}] ${r.name}`);
  if (!r.ok) { failed++; console.log(`        ↳ ${r.note}`); }
}
console.log(`\n${failed === 0 ? "🟢 ALL GREEN" : `🔴 ${failed}/${results.length} ĐỎ`}\n`);
console.log("Nhắc: gate còn phải giữ design-guards 9/9 + home-ai-first 5/5 (đặc biệt H3/H4) XANH.\n");
process.exit(failed === 0 ? 0 : 1);
