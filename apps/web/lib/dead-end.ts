/**
 * STORY 1-1: 1 chỗ duy nhất ghi nhận "ngõ cụt" (404→ngữ cảnh / phiên hết hạn / hết mã).
 * Hiện log ra console; muốn đẩy analytics/Sentry sau này chỉ sửa ở đây. `kind` có union type
 * nên typo bị TS bắt thay vì lọt thành metric rác.
 */
export type DeadEndKind =
  | "niche-inactive"
  | "coupon-merchant-empty"
  | "session-expired"
  | "share-expired";

export function logDeadEnd(kind: DeadEndKind, ctx: Record<string, string> = {}): void {
  const fields = Object.entries(ctx)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.info(`[dead-end] kind=${kind}${fields ? ` ${fields}` : ""}`);
}
