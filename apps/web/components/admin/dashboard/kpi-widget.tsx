import { fetchKpiSummary } from "../../../app/admin/actions";
import { formatMoney } from "../../../lib/format";

/**
 * STORY-03 AC3: KPI widget với data thật.
 * Hôm qua + tháng này (clicks → orders → revenue).
 */
export async function KpiWidget() {
  let data;
  try {
    data = await fetchKpiSummary();
  } catch {
    data = {
      yesterday: { clicks: 0, orders: 0, revenue: 0 },
      month: { clicks: 0, orders: 0, revenue: 0 }
    };
  }

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <h3 className="text-base font-semibold text-admin-ink">👋 Xin chào!</h3>
      <p className="mt-0.5 text-xs text-admin-mute">Site bạn hôm nay thế nào?</p>
      <div className="mt-4 space-y-2 text-sm">
        <KpiRow label="Hôm qua" {...data.yesterday} />
        <KpiRow label="Tháng này" {...data.month} />
      </div>
    </div>
  );
}

function KpiRow(props: { label: string; clicks: number; orders: number; revenue: number }) {
  return (
    <div className="flex items-baseline gap-2 text-admin-ink">
      <span className="w-20 text-admin-ink-soft">{props.label}:</span>
      <span className="font-semibold">{props.clicks} click</span>
      <span className="text-admin-mute">→</span>
      <span className="font-semibold">{props.orders} đơn</span>
      <span className="text-admin-mute">→</span>
      <span className="font-bold text-admin-success">{formatMoney(props.revenue, "VND")}</span>
    </div>
  );
}
