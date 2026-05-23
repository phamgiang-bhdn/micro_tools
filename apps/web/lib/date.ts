const VN_OFFSET_MS = 7 * 3600 * 1000;

/** Return YYYY-MM-DD for "today" in Asia/Ho_Chi_Minh (UTC+7). */
export function todayVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return vn.toISOString().slice(0, 10);
}

/** Return YYYY-MM-DD for a date offset in days from VN today. */
export function vnDateOffset(days: number): string {
  const now = new Date();
  const vn = new Date(now.getTime() + VN_OFFSET_MS + days * 86400000);
  return vn.toISOString().slice(0, 10);
}

export function isValidYmd(s: string | undefined | null): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00+07:00").getTime());
}

export function formatVnDate(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
