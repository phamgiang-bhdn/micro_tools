/**
 * dev: Chạy cả Frontend (Next.js) và Backend (NestJS) cùng lúc
 * Tự động kiểm tra và setup môi trường nếu cần thiết
 * Chỉ cần 1 lệnh: npm run dev
 */
import { spawn, spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const { existsSync } = fs;
import { bannerOk, bannerRun, bannerFail, c } from "./colors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// ========== Auto-setup functions ==========

function checkNodeModules() {
  const nodeModulesPath = join(root, "node_modules");
  return existsSync(nodeModulesPath);
}

function checkEnvFile() {
  const envPath = join(root, ".env");
  return existsSync(envPath);
}

function checkDockerRunning() {
  try {
    const result = spawnSync("docker", ["compose", "ps", "--services", "--filter", "status=running"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    const output = result.stdout.toString().trim();
    return output.includes("postgres") || output.includes("db");
  } catch {
    return false;
  }
}

function runCommandSync(cmd, args, description) {
  console.log(`\n${c.yellow}[SETUP]${c.reset} ${description}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true
  });
  if (result.status !== 0) {
    bannerFail(`${description} thất bại`);
    return false;
  }
  bannerOk(`${description} thành công`);
  return true;
}

async function autoSetup() {
  let needsSetup = false;

  // 1. Check node_modules
  if (!checkNodeModules()) {
    console.log(`\n${c.yellow}[CHECK]${c.reset} Dependencies chưa được cài đặt`);
    needsSetup = true;
    if (!runCommandSync(isWin ? "npm.cmd" : "npm", ["install"], "Cài đặt dependencies")) {
      process.exit(1);
    }
  }

  // 2. Check .env file
  if (!checkEnvFile()) {
    console.log(`${c.yellow}[CHECK]${c.reset} File .env chưa tồn tại`);
    needsSetup = true;
    if (!runCommandSync("node", ["scripts/copy-env-if-missing.mjs"], "Tạo file .env")) {
      process.exit(1);
    }
  }

  // 3. Check Docker
  if (!checkDockerRunning()) {
    console.log(`${c.yellow}[CHECK]${c.reset} Docker containers chưa chạy`);
    needsSetup = true;
    if (!runCommandSync("docker", ["compose", "up", "-d"], "Khởi động Docker containers")) {
      console.log(`${c.yellow}[WARN]${c.reset} Không thể khởi động Docker. Bạn cần cài Docker Desktop.`);
    }
    // Đợi DB khởi động
    console.log(`${c.yellow}[WAIT]${c.reset} Đợi database khởi động (5 giây)...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Deploy migrations
    if (!runCommandSync("npm", ["run", "prisma:deploy", "--workspace", "api"], "Deploy database migrations")) {
      console.log(`${c.yellow}[WARN]${c.reset} Migration thất bại. Kiểm tra database connection.`);
    }
  }

  if (needsSetup) {
    bannerOk("Setup hoàn tất!");
  } else {
    bannerOk("Môi trường đã sẵn sàng");
  }
}

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

// ========== Port conflict resolution ==========

function findAndKillProcessOnPort(port) {
  return new Promise((resolve) => {
    const cmd = isWin 
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} -t`;
    
    const result = spawnSync(cmd, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    const output = result.stdout.toString().trim();
    
    if (!output) {
      resolve();
      return;
    }
    
    const pids = isWin
      ? output.split('\n').map(line => line.trim().split(/\s+/).pop()).filter(Boolean)
      : output.split('\n').filter(Boolean);
    
    const uniquePids = [...new Set(pids)];
    
    if (uniquePids.length > 0) {
      console.log(`${c.yellow}[PORT]${c.reset} Port ${port} đang bị chiếm bởi PID: ${uniquePids.join(", ")}`);
      console.log(`${c.yellow}[PORT]${c.reset} Đang giải phóng port ${port}...`);
      
      uniquePids.forEach(pid => {
        try {
          process.kill(parseInt(pid), "SIGTERM");
        } catch {
          try {
            process.kill(parseInt(pid), "SIGKILL");
          } catch {
            // Ignore if process already exited
          }
        }
      });
      
      // Đợi processes dừng
      setTimeout(resolve, 1000);
    } else {
      resolve();
    }
  });
}

// Run auto-setup before starting servers
console.log(`\n${c.cyan}${c.bold}🔍 Kiểm tra môi trường...${c.reset}`);
await autoSetup();

// Giải phóng ports nếu cần
console.log(`\n${c.yellow}[PORT]${c.reset} Kiểm tra ports 4000 và 3100...`);
await findAndKillProcessOnPort(4000);
await findAndKillProcessOnPort(3100);

console.log(`\n${c.magenta}${c.bold}═══════════════════════════════════════════════════${c.reset}`);
console.log(`${c.magenta}${c.bold}         🚀 STARTING DEVELOPMENT SERVERS${c.reset}`);
console.log(`${c.magenta}${c.bold}         API:  http://localhost:4000${c.reset}`);
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