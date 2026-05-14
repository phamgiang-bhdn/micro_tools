/** Màu ANSI — hiện rõ trên Windows Terminal / VS Code terminal */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

export function bannerRun(title) {
  console.log(`\n${c.cyan}${c.bold}▶ ${title}${c.reset}\n`);
}

export function bannerOk(title) {
  console.log(`\n${c.green}${c.bold}✓ THÀNH CÔNG${c.reset} ${c.dim}— ${title}${c.reset}\n`);
}

export function bannerFail(title, code, signal) {
  const extra = signal ? ` signal ${signal}` : "";
  console.log(
    `\n${c.red}${c.bold}✗ THẤT BẠI${c.reset} ${c.dim}— ${title} (exit ${code ?? "?"}${extra})${c.reset}\n`
  );
}
