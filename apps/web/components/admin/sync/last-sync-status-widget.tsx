import { fetchSyncStatus } from "../../../app/admin/actions";

const LABELS: Record<string, string> = {
  crawler: "Crawler",
  reconcile: "Đối soát",
  coupon: "Coupon",
  top_products: "Top deal",
  commission_rank: "Commission rank",
  keyword_radar: "Keyword radar"
};

const BACKBONE = ["crawler", "reconcile", "coupon", "top_products"];

/**
 * STORY-02: RSC render last-success age cho 4 backbone sync.
 * Stale (lastSuccess >2× expected) → red.
 */
export async function LastSyncStatusWidget() {
  let data;
  try {
    data = await fetchSyncStatus();
  } catch (err) {
    return (
      <div className="rounded-xl border border-admin-line bg-admin-surface p-5 text-xs text-admin-mute">
        Không tải được sync status: {err instanceof Error ? err.message : "unknown"}
      </div>
    );
  }
  const backbone = data.filter((d) => BACKBONE.includes(d.name));
  const anyIssue = backbone.some((d) => d.isStale || d.lastError);

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <h3 className="text-sm font-semibold text-admin-ink">⚙ Hệ thống (4 luồng nền)</h3>
      <ul className="mt-3 space-y-1.5 text-xs">
        {backbone.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={
                d.isStale || d.lastError
                  ? "inline-block size-2 rounded-full bg-admin-danger"
                  : "inline-block size-2 rounded-full bg-admin-success"
              }
            />
            <span className="flex-1 text-admin-ink">{LABELS[d.name] ?? d.name}</span>
            <span
              className={
                d.isStale ? "text-[11px] text-admin-danger" : "text-[11px] text-admin-mute"
              }
            >
              {d.lastSuccessAt ? formatAgo(d.ageSec) : "chưa chạy"}
            </span>
          </li>
        ))}
      </ul>
      <p
        className={
          anyIssue
            ? "mt-3 text-xs font-medium text-admin-danger"
            : "mt-3 text-xs font-medium text-admin-success"
        }
      >
        {anyIssue ? "→ Cần đồng bộ" : "→ Tất cả OK"}
      </p>
    </div>
  );
}

function formatAgo(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s trước`;
  if (sec < 3600) return `${Math.floor(sec / 60)} phút`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h trước`;
  return `${Math.floor(sec / 86400)} ngày`;
}
