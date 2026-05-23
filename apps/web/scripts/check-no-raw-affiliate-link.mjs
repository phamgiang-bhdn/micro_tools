#!/usr/bin/env node
// Guardrail: ngăn raw <a href={... affiliateUrl ...}> hoặc <a href={... affLink ...}>
// trong components/storefront/** và components/article/**. Mọi outbound affiliate
// PHẢI đi qua server action (trackAndRedirectAction hoặc trackTopSnapshotRedirectAction)
// để bảo toàn attribution. Xem docs/sprints/vn-storefront-v2/stories/STORY-01.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const ROOTS = ["components/storefront", "components/article"];
const PATTERN = /<a\b[^>]*href=\{[^}]*(?:affiliateUrl|affLink)[^}]*\}/;

let failed = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
    } else if (f.endsWith(".tsx")) {
      const content = readFileSync(p, "utf8");
      if (PATTERN.test(content)) {
        console.error(`[check:tracking] Raw affiliate <a> in ${p}`);
        failed++;
      }
    }
  }
}

for (const r of ROOTS) walk(join(webRoot, r));

if (failed > 0) {
  console.error(`\n${failed} file(s) bypass tracking. Wrap với <form action={trackAndRedirectAction}>.`);
  process.exit(1);
}
console.log("[check:tracking] OK — no raw affiliate <a> outbound.");
