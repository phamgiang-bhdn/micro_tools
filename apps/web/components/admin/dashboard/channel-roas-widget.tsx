import Link from "next/link";
import { fetchMoneyTrailChannels } from "../../../app/admin/actions";
import { formatMoney } from "../../../lib/format";

const LABELS: Record<string, string> = {
  organic: "SEO/Organic",
  fb: "Facebook",
  zalo: "Zalo",
  email: "Email",
  direct: "Direct",
  other: "Khác"
};

/**
 * STORY-06: ROAS widget — clicks/orders/revenue/spend/ROAS per channel.
 */
export async function ChannelROASWidget() {
  let rows;
  try {
    rows = await fetchMoneyTrailChannels(7);
  } catch {
    rows = [];
  }

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-admin-ink">💵 Tiền theo kênh (7 ngày)</h3>
        <Link href="/admin/money-trail" className="text-xs text-admin-accent hover:underline">
          Chi tiết →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-admin-mute">Chưa có click nào trong 7 ngày.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.channel} className="flex items-center gap-2">
              <span className="w-24 text-xs text-admin-ink-soft">
                {LABELS[row.channel] ?? row.channel}
              </span>
              <span className="flex-1 text-xs text-admin-ink">
                {row.clicks} click → {row.orders} đơn →{" "}
                <span className="font-semibold text-admin-success">
                  {formatMoney(row.revenue, "VND")}
                </span>
              </span>
              {row.roas !== null ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    row.roas >= 2
                      ? "bg-admin-success-soft text-admin-success"
                      : row.roas >= 1
                        ? "bg-admin-warning-soft text-admin-warning"
                        : "bg-admin-danger-soft text-admin-danger"
                  }`}
                >
                  ROAS {row.roas.toFixed(1)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
