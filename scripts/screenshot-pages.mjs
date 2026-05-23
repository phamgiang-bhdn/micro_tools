// Quick screenshot tour of dealvault for UX audit.
// Run: node scripts/screenshot-pages.mjs

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "c:/tmp/dv-screens";
mkdirSync(OUT_DIR, { recursive: true });

const BASE = "http://localhost:3100";

/** @type {Array<{name: string, url: string, fullPage?: boolean, viewport?: {width:number,height:number}, wait?: number}>} */
const pages = [
  { name: "01-home-desktop", url: "/", fullPage: true },
  { name: "02-home-mobile", url: "/", fullPage: true, viewport: { width: 390, height: 844 } },
  { name: "03-blog-list", url: "/blog", fullPage: true },
  { name: "04-niche-laptop", url: "/categories/laptop", fullPage: true },
  { name: "05-niche-may-loc-nuoc", url: "/categories/may-loc-nuoc", fullPage: true },
  { name: "06-coupons-shopee", url: "/khuyen-mai/shopee", fullPage: true },
  { name: "07-admin-login", url: "/admin", fullPage: true },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const p of pages) {
  if (p.viewport) await page.setViewportSize(p.viewport);
  else await page.setViewportSize({ width: 1440, height: 900 });
  console.log(`→ ${p.url}`);
  try {
    await page.goto(BASE + p.url, { waitUntil: "networkidle", timeout: 30000 });
    if (p.wait) await page.waitForTimeout(p.wait);
    await page.screenshot({ path: join(OUT_DIR, p.name + ".png"), fullPage: Boolean(p.fullPage) });
    console.log(`  ✓ ${p.name}.png`);
  } catch (e) {
    console.log(`  ✗ ${p.name}: ${e.message}`);
  }
}

await browser.close();
console.log("Done. Open " + OUT_DIR);
