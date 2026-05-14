/**
 * In hướng dẫn script (tiếng Việt). Chạy: npm run help
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { c } from "./colors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const help = pkg._scripts_help;

console.log(
  `\n${c.cyan}${c.bold}=== Lệnh npm (mô tả trong package.json → _scripts_help) ===${c.reset}\n`
);
console.log(
  `${c.dim}Các lệnh docker/db/setup/... in ${c.green}✓ THÀNH CÔNG${c.dim} / ${c.red}✗ THẤT BẠI${c.dim} màu sau khi chạy xong.${c.reset}\n`
);
if (help && typeof help === "object") {
  const width = Math.max(...Object.keys(help).map((k) => k.length), 18);
  for (const [name, desc] of Object.entries(help)) {
    console.log(`  ${c.yellow}${name.padEnd(width)}${c.reset}  ${desc}`);
  }
} else {
  console.log("  (chưa có _scripts_help trong package.json)");
}
console.log(`\n${c.green}Gợi ý lần đầu:${c.reset}  npm run bootstrap`);
console.log(
  `${c.green}Chạy app:${c.reset}       hai terminal — npm run dev:api  và  npm run dev:web  →  http://localhost:3100\n`
);
