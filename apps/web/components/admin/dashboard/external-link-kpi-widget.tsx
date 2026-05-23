import Link from "next/link";
import { fetchTrackedLinkKpi } from "../../../app/admin/actions";
import { formatMoney } from "../../../lib/format";

/**
 * STORY-08: KPI widget cho /admin/external-links.
 */
export async function ExternalLinkKpiWidget() {
  let kpi;
  try {
    kpi = await fetchTrackedLinkKpi(7);
  } catch {
    kpi = {
      totalLinks: 0,
      activeLinks: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      byChannel: {}
    };
  }

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-admin-ink">🔗 Link ngoài site (7 ngày)</h3>
        <Link href="/admin/external-links" className="text-xs text-admin-accent hover:underline">
          Quản lý →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Active" value={String(kpi.activeLinks)} />
        <Stat label="Đơn ghi nhận" value={String(kpi.totalConversions)} />
      </div>
      <p className="mt-3 text-xs text-admin-ink-soft">Revenue tuần</p>
      <p className="text-xl font-bold text-admin-success">{formatMoney(kpi.totalRevenue, "VND")}</p>
      <Link
        href="/admin/external-links/new"
        className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        + Tạo link mới
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-admin-mute">{label}</p>
      <p className="text-lg font-bold text-admin-ink">{value}</p>
    </div>
  );
}
