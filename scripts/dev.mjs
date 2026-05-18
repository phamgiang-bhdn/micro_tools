/**
 * dev: Chạy cả Frontend (Next.js) và Backend (NestJS) cùng lúc
 * Chỉ cần 1 lệnh: npm run dev
 */
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { bannerOk, bannerRun, bannerFail, c } from "./colors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

let apiProcess = null;
let webProcess = null;

function runDev(title, commandLine, color) {
  bannerRun(title);
  const child = spawn(commandLine, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    cwd: root,
    env: { ...process.env, FORCE_COLOR: "1" }
  });

  let buffer = "";
  child.stdout.on("data", (data) => {
    buffer += data.toString();
    let lineEndIndex;
    while ((lineEndIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEndIndex).trim();
      buffer = buffer.slice(lineEndIndex + 1);
      if (line) {
        console.log(`${color}[${title}]${c.reset} ${line}`);
      }
    }
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().split("\n").filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${color}[${title}]${c.reset} ${line}`);
    });
  });

  child.on("exit", (code, signal) => {
    if (code === 0 || code === null) {
      bannerOk(`${title} đã dừng`);
    } else {
      bannerFail(`${title} dừng với mã: ${code}`);
    }
    stopAll();
  });

  return child;
}

function stopAll() {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
  if (webProcess) {
    webProcess.kill("SIGTERM");
    webProcess = null;
  }
}

function handleShutdown() {
  console.log(`\n${c.yellow}${c.bold}⏹  Đang dừng servers...${c.reset}`);
  stopAll();
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

// Build command line string for shell execution
const npmCmd = isWin ? "npm" : "npm";

console.log(`\n${c.magenta}${c.bold}═══════════════════════════════════════════════════${c.reset}`);
console.log(`${c.magenta}${c.bold}         🚀 STARTING DEVELOPMENT SERVERS${c.reset}`);
console.log(`${c.magenta}${c.bold}         API:  http://localhost:3000 (default)${c.reset}`);
console.log(`${c.magenta}${c.bold}         WEB:  http://localhost:3100${c.reset}`);
console.log(`${c.magenta}${c.bold}═══════════════════════════════════════════════════${c.reset}\n`);

// Chạy API (NestJS) - dùng chuỗi command để spawn với shell
apiProcess = runDev(
  "API",
  `${npmCmd} run start:dev --workspace api`,
  c.cyan
);

// Wait for API to compile successfully before starting web
console.log(`${c.yellow}⏳ Waiting for API to be ready...${c.reset}`);
setTimeout(() => {
  // Chạy WEB (Next.js)
  webProcess = runDev(
    "WEB",
    `${npmCmd} run dev --workspace web`,
    c.green
  );
}, 8000);

console.log(`\n${c.magenta}${c.bold}★ Cả 2 servers đang chạy. Nhấn Ctrl+C để dừng.${c.reset}\n`);