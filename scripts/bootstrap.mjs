/**
 * bootstrap: env:init + setup (có màu)
 */
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { bannerFail, bannerOk, bannerRun, c } from "./colors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

function runNode(scriptRelative) {
  return new Promise((resolve, reject) => {
    const script = join(root, scriptRelative);
    bannerRun(`node ${scriptRelative}`);
    const child = spawn(process.execPath, [script], { stdio: "inherit", cwd: root });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        bannerOk(`node ${scriptRelative}`);
        resolve();
      } else {
        bannerFail(`node ${scriptRelative}`, code, signal);
        reject(new Error(String(code)));
      }
    });
  });
}

try {
  await runNode("scripts/copy-env-if-missing.mjs");
  const setup = join(root, "scripts", "setup.mjs");
  bannerRun("node scripts/setup.mjs");
  const child = spawn(process.execPath, [setup], { stdio: "inherit", cwd: root });
  await new Promise((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (code === 0) {
        bannerOk("node scripts/setup.mjs");
        resolve();
      } else {
        bannerFail("node scripts/setup.mjs", code, signal);
        reject(new Error(String(code)));
      }
    });
  });
  console.log(`${c.magenta}${c.bold}★ Bootstrap xong — nhớ chỉnh ADMIN_API_KEY / GEMINI trong .env nếu cần${c.reset}\n`);
} catch {
  process.exit(1);
}
