/** HEAD check URL còn live + content-type. Timeout 3s mặc định. */
export async function headCheck(
  url: string,
  expectPrefix?: string,
  timeoutMs = 3000
): Promise<{ ok: boolean; status?: number; contentType?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ok: false, status: res.status, contentType: ct };
    if (expectPrefix && !ct.startsWith(expectPrefix)) return { ok: false, status: res.status, contentType: ct };
    return { ok: true, status: res.status, contentType: ct };
  } catch {
    return { ok: false };
  }
}

/** GET text với timeout — dùng cho WebFetch trong Research/Fact-Check. */
export async function fetchText(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

import { createHash } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hostnameOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
