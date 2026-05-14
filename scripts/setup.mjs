/**
 * setup: docker + migrate deploy + seed (có banner từng bước)
 */
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { bannerFail, bannerOk, bannerRun, c } from "./colors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

function runStep(title, command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    bannerRun(title);
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: isWin,
      cwd: options.cwd ?? root,
      env: { ...process.env, ...options.env }
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        bannerOk(title);
        resolve();
      } else {
        bannerFail(title, code, signal);
        reject(new Error(String(code)));
      }
    });
  });
}

try {
  await runStep("Docker Compose (up)", "docker", ["compose", "up", "-d"]);
  await runStep("Prisma migrate deploy", "npx", ["prisma", "migrate", "deploy"], { cwd: apiDir });
  await runStep("Prisma seed", npm, ["run", "prisma:seed", "--workspace", "api"], { cwd: root });
  console.log(`${c.magenta}${c.bold}★ Hoàn tất toàn bộ setup${c.reset}\n`);
} catch {
  console.log(`${c.red}${c.bold}Dừng setup do lỗi ở bước trên.${c.reset}\n`);
  process.exit(1);
}
