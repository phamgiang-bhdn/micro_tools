/**
 * dev: Chạy cả Frontend (Next.js) và Backend (NestJS) cùng lúc
 * Tự động kiểm tra và setup môi trường nếu cần thiết
 * Chỉ cần 1 lệnh: npm run dev
 *
 * Robustness: Script tự động kiểm tra và xử lý các trường hợp:
 * - Docker chưa cài / docker compose vs docker-compose
 * - Node.js version không tương thích
 * - Port conflicts (PID 0, system processes)
 * - Database healthcheck wait
 * - Missing dependencies, .env files
 */
import { spawn, spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const { existsSync } = fs;
import { bannerOk, bannerRun, bannerFail, c } from "./colors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// ========== Check functions ==========

function checkNodeVersion() {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  return major >= 18; // Minimum Node.js 18
}

function checkNodeModules() {
  const nodeModulesPath = join(root, "node_modules");
  return existsSync(nodeModulesPath);
}

function checkEnvFile() {
  const envPath = join(root, ".env");
  const apiEnvPath = join(root, "apps", "api", ".env");
  const webEnvPath = join(root, "apps", "web", ".env");
  return existsSync(envPath) || (existsSync(apiEnvPath) && existsSync(webEnvPath));
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

function checkDockerInstalled() {
  try {
    const result = spawnSync("docker", ["--version"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function getDockerComposeCommand() {
  // Check for docker compose (v2) first, then docker-compose (v1)
  try {
    const result = spawnSync("docker", ["compose", "version"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    if (result.status === 0) {
      return { cmd: "docker", args: ["compose"] };
    }
  } catch {}
  
  try {
    const result = spawnSync("docker-compose", ["--version"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    if (result.status === 0) {
      return { cmd: "docker-compose", args: [] };
    }
  } catch {}
  
  return null;
}

function checkDockerRunning() {
  const composeCmd = getDockerComposeCommand();
  if (!composeCmd) return false;
  
  try {
    const result = spawnSync(composeCmd.cmd, [...composeCmd.args, "ps", "--services", "--filter", "status=running"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });
    const output = result.stdout.toString().trim();
    return output.includes("postgres") || output.includes("affiliate-postgres");
  } catch {
    return false;
  }
}

function waitForDatabase(timeoutMs = 30000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    
    function check() {
      try {
        // Try to connect to postgres on port 6432
        const result = spawnSync(isWin ? "powershell" : "bash", 
          isWin 
            ? ["-Command", `Test-NetConnection -ComputerName localhost -Port 6432 -WarningLevel SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded`]
            : ["-c", `echo "" | nc -w 1 localhost 6432 && echo "success" || echo "fail"`],
          { stdio: ["pipe", "pipe", "pipe"], shell: true }
        );
        const output = result.stdout.toString().trim().toLowerCase();
        if (output.includes("true") || output.includes("success")) {
          resolve(true);
          return;
        }
      } catch {}
      
      if (Date.now() - startTime > timeoutMs) {
        console.log(`${c.yellow}[WARN]${c.reset} Timeout đợi database (${timeoutMs/1000}s). Sẽ thử tiếp...`);
        resolve(false);
        return;
      }
      
      setTimeout(check, checkInterval);
    }
    
    console.log(`${c.yellow}[WAIT]${c.reset} Đang đợi database sẵn sàng (max ${timeoutMs/1000}s)...`);
    check();
  });
}

async function autoSetup() {
  let needsSetup = false;

  // 0. Check Node.js version
  if (!checkNodeVersion()) {
    bannerFail(`Node.js version ${process.version} quá cũ. Cần Node.js 18+`);
    console.log(`\n${c.yellow}[HƯỚNG DẪN]${c.reset} Cài Node.js 18+ từ https://nodejs.org/`);
    process.exit(1);
  }
  console.log(`${c.green}[CHECK]${c.reset} Node.js ${process.version} ✓`);

  // 1. Check node_modules
  if (!checkNodeModules()) {
    console.log(`\n${c.yellow}[CHECK]${c.reset} Dependencies chưa được cài đặt`);
    needsSetup = true;
    if (!runCommandSync(isWin ? "npm.cmd" : "npm", ["install"], "Cài đặt dependencies")) {
      bannerFail("Không thể cài đặt dependencies");
      console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Chạy thủ công: npm install`);
      process.exit(1);
    }
  } else {
    console.log(`${c.green}[CHECK]${c.reset} Dependencies ✓`);
  }

  // 2. Check .env files
  if (!checkEnvFile()) {
    console.log(`${c.yellow}[CHECK]${c.reset} File .env chưa tồn tại`);
    needsSetup = true;
    if (!runCommandSync("node", ["scripts/copy-env-if-missing.mjs"], "Tạo file .env")) {
      bannerFail("Không thể tạo file .env");
      console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Copy apps/api/.env.example → apps/api/.env và apps/web/.env.example → apps/web/.env`);
      process.exit(1);
    }
  } else {
    console.log(`${c.green}[CHECK]${c.reset} .env files ✓`);
  }

  // 3. Check Docker
  if (!checkDockerInstalled()) {
    console.log(`\n${c.yellow}[CHECK]${c.reset} Docker chưa được cài đặt`);
    console.log(`${c.yellow}[WARN]${c.reset} Không có Docker, bạn cần có PostgreSQL riêng để chạy API.`);
    console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Cài Docker Desktop từ https://www.docker.com/products/docker-desktop/`);
    console.log(`${c.yellow}[HOẶC]${c.reset} Chỉnh DATABASE_URL trong apps/api/.env trỏ tới PostgreSQL của bạn.`);
    return; // Skip Docker setup but continue with dev
  }
  
  const composeCmd = getDockerComposeCommand();
  if (!composeCmd) {
    console.log(`${c.yellow}[WARN]${c.reset} Không tìm thấy docker compose hoặc docker-compose.`);
    console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Cài Docker Desktop hoặc Docker Compose plugin.`);
    return;
  }

  if (!checkDockerRunning()) {
    console.log(`\n${c.yellow}[CHECK]${c.reset} Docker containers chưa chạy`);
    needsSetup = true;
    
    if (!runCommandSync(composeCmd.cmd, [...composeCmd.args, "up", "-d"], "Khởi động Docker containers")) {
      console.log(`${c.yellow}[WARN]${c.reset} Không thể khởi động Docker containers.`);
      console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Kiểm tra Docker Desktop đang chạy, hoặc chỉnh DATABASE_URL trong apps/api/.env.`);
      return;
    }
    
    // Đợi DB healthcheck thay vì fixed timeout
    const dbReady = await waitForDatabase(30000);
    if (!dbReady) {
      console.log(`${c.yellow}[WARN]${c.reset} Database chưa sẵn sàng sau 30s. Kiểm tra docker logs affiliate-postgres.`);
    } else {
      console.log(`${c.green}[OK]${c.reset} Database đã sẵn sàng!`);
    }
    
    // Deploy migrations
    if (!runCommandSync("npm", ["run", "prisma:deploy", "--workspace", "api"], "Deploy database migrations")) {
      console.log(`${c.yellow}[WARN]${c.reset} Migration thất bại.`);
      console.log(`${c.yellow}[HƯỚNG DẪN]${c.reset} Kiểm tra DATABASE_URL trong apps/api/.env hoặc chạy: docker logs affiliate-postgres`);
    }
  } else {
    console.log(`${c.green}[CHECK]${c.reset} Docker containers ✓`);
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
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -i :${port} -t`;
    
    const result = spawnSync(cmd, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    const output = result.stdout.toString().trim();
    
    if (!output) {
      resolve();
      return;
    }
    
    let pids = [];
    if (isWin) {
      // Windows netstat output format: TCP  0.0.0.0:4000  0.0.0.0:0  LISTENING  PID
      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Split by whitespace and get the last element (PID)
        const parts = trimmed.split(/\s+/);
        const pid = parts[parts.length - 1];
        // Validate PID is a number and not 0 (System Idle Process cannot be killed)
        const pidNum = parseInt(pid, 10);
        if (!isNaN(pidNum) && pidNum > 0) {
          pids.push(pid);
        }
      }
    } else {
      pids = output.split('\n').filter(Boolean);
    }
    
    const uniquePids = [...new Set(pids)];
    
    if (uniquePids.length > 0) {
      console.log(`${c.yellow}[PORT]${c.reset} Port ${port} đang bị chiếm bởi PID: ${uniquePids.join(", ")}`);
      console.log(`${c.yellow}[PORT]${c.reset} Đang giải phóng port ${port}...`);
      
      uniquePids.forEach(pid => {
        const pidNum = parseInt(pid, 10);
        // Skip PID 0 (System Idle Process) - cannot be killed
        if (pidNum === 0) {
          console.log(`${c.yellow}[PORT]${c.reset} Bỏ qua PID 0 (System Idle Process)`);
          return;
        }
        try {
          if (isWin) {
            // On Windows, use taskkill for more reliable process termination
            spawnSync("taskkill", ["/F", "/PID", pid], { shell: true, stdio: ["pipe", "pipe", "pipe"] });
          } else {
            process.kill(pidNum, "SIGTERM");
          }
        } catch (err) {
          try {
            if (isWin) {
              spawnSync("taskkill", ["/F", "/PID", pid], { shell: true, stdio: ["pipe", "pipe", "pipe"] });
            } else {
              process.kill(pidNum, "SIGKILL");
            }
          } catch {
            // Ignore if process already exited
          }
        }
      });
      
      // Đợi processes dừng
      setTimeout(resolve, 1500);
    } else {
      // Port might be used by PID 0 or system process that cannot be killed
      console.log(`${c.yellow}[PORT]${c.reset} Port ${port} đang được sử dụng bởi tiến trình hệ thống (không thể kill)`);
      console.log(`${c.yellow}[PORT]${c.reset} Sẽ thử khởi động server anyway...`);
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