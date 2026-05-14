import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { c } from "./colors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const pairs = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env"]
];

for (const [example, target] of pairs) {
  const from = path.join(root, example);
  const to = path.join(root, target);
  if (!fs.existsSync(to)) {
    fs.copyFileSync(from, to);
    console.log(`${c.green}Đã tạo${c.reset} ${c.yellow}${target}${c.reset} từ ${c.dim}${example}${c.reset}`);
  } else {
    console.log(`${c.dim}Bỏ qua ${target} (đã tồn tại)${c.reset}`);
  }
}

console.log(
  `${c.cyan}Xong.${c.reset} Chỉnh ${c.bold}ADMIN_API_KEY${c.reset} (giống nhau ở api + web) và ${c.bold}GEMINI_API_KEY${c.reset} trong apps/api/.env nếu cần AI.\n`
);
