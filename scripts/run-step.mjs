/**
 * Chạy một lệnh, in banner màu đầu/cuối.
 * Dùng: node scripts/run-step.mjs -- docker compose up -d
 *       node scripts/run-step.mjs -- npm run prisma:deploy --workspace api
 */
import { spawn } from "child_process";
import { bannerFail, bannerOk, bannerRun, c } from "./colors.mjs";

const idx = process.argv.indexOf("--");
const parts = idx >= 0 ? process.argv.slice(idx + 1) : process.argv.slice(2);

if (parts.length === 0) {
  console.error(`${c.red}Thiếu lệnh. Ví dụ:${c.reset}`);
  console.error(`  node scripts/run-step.mjs -- docker compose up -d`);
  process.exit(1);
}

let cmd = parts[0];
const args = parts.slice(1);
if (process.platform === "win32" && cmd === "npm") {
  cmd = "npm.cmd";
}

const label = [cmd, ...args].join(" ");
bannerRun(label);

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (code === 0) {
    bannerOk(label);
    process.exit(0);
  }
  bannerFail(label, code, signal);
  process.exit(code ?? 1);
});
