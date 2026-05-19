#!/usr/bin/env node
// Kill mọi process đang giữ một (hoặc nhiều) port. Cross-platform: Windows + macOS/Linux.
// Usage: node scripts/kill-port.mjs 4000 3100

import { execSync } from "node:child_process";
import { platform } from "node:os";

const ports = process.argv.slice(2).filter((p) => /^\d+$/.test(p));
if (ports.length === 0) {
  console.error("Usage: node scripts/kill-port.mjs <port> [port ...]");
  process.exit(1);
}

const isWin = platform() === "win32";

function findPids(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/LISTENING\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      return [...pids];
    }
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (isWin) execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

let totalKilled = 0;
for (const port of ports) {
  const pids = findPids(port);
  if (pids.length === 0) {
    console.log(`✓ Port ${port} đã free.`);
    continue;
  }
  for (const pid of pids) {
    const ok = killPid(pid);
    console.log(`${ok ? "✓ Killed" : "✗ Failed"} PID ${pid} on port ${port}`);
    if (ok) totalKilled += 1;
  }
}

if (totalKilled > 0) console.log(`\nDone — killed ${totalKilled} process(es).`);
