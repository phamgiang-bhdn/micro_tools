import type React from "react";

interface ConversionHook {
  revenue: string;
  status: string;
  source?: string | null;
  atOrderId?: string | null;
  atCommission?: string | null;
  reconcileNotes?: string | null;
  lastReconciledAt?: string | null;
}

interface MoneyTrailRow {
  trackingCode: string;
  ipHash: string;
  userAgent: string | null;
  createdAt: string;
  product: { name: string; network: string };
  conversionHooks: ConversionHook[];
}

export function MoneyTrailTable({ rows }: { rows: MoneyTrailRow[] }): React.ReactElement {
  const totalRevenue = rows.reduce((sum, row) => {
    const top = row.conversionHooks[0];
    if (!top) return sum;
    const num = Number(top.revenue);
    return Number.isFinite(num) ? sum + num : sum;
  }, 0);
  const totalConverted = rows.filter((r) => r.conversionHooks.length > 0).length;
  const mismatchCount = rows.filter((r) => r.conversionHooks.some((h) => h.reconcileNotes)).length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryStat label="Clicks gần nhất" value={String(rows.length)} />
        <SummaryStat label="Có conversion" value={String(totalConverted)} tone="accent" />
        <SummaryStat
          label="Doanh thu (ước)"
          value={totalRevenue > 0 ? `₫${totalRevenue.toLocaleString("vi-VN")}` : "—"}
          tone="brand"
        />
        <SummaryStat
          label="Lệch reconcile"
          value={String(mismatchCount)}
          tone={mismatchCount > 0 ? "warning" : undefined}
        />
      </div>

      <article className="admin-card overflow-hidden p-0">
        <div className="border-b border-admin-line px-5 py-3 text-sm font-semibold text-admin-ink">
          Money trail · {rows.length} dòng gần nhất
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-admin-line bg-admin-subtle text-left text-xs font-semibold uppercase tracking-wider text-admin-mute">
                <th className="px-5 py-3">Tracking</th>
                <th className="px-5 py-3">Sản phẩm</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">IP hash</th>
                <th className="px-5 py-3">Last reconciled</th>
                <th className="px-5 py-3 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-admin-mute">
                    Chưa có click nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const top = row.conversionHooks[0];
                  return (
                    <tr key={row.trackingCode} className="border-b border-admin-line last:border-b-0 hover:bg-admin-subtle/60">
                      <td className="px-5 py-3 font-mono text-xs text-admin-ink">{row.trackingCode}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-admin-ink">{row.product.name}</p>
                        <p className="text-xs text-admin-mute">{row.product.network}</p>
                      </td>
                      <td className="px-5 py-3">
                        {top ? <SourceBadge source={top.source ?? null} note={top.reconcileNotes ?? null} /> : <span className="text-xs text-admin-mute">—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-admin-mute">{row.ipHash}</td>
                      <td className="px-5 py-3 text-xs text-admin-mute">
                        {top?.lastReconciledAt ? formatRelative(top.lastReconciledAt) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {top ? <StatusPill status={top.status} revenue={top.revenue} /> : <span className="text-xs text-admin-mute">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "brand" | "accent" | "warning";
}): React.ReactElement {
  const cls =
    tone === "brand"
      ? "text-primary-700"
      : tone === "accent"
      ? "text-emerald-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-admin-ink";
  return (
    <div className="admin-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">{label}</p>
      <p className={`mt-1 text-xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status, revenue }: { status: string; revenue: string }): React.ReactElement {
  const ok = status.toUpperCase() === "CONFIRMED" || status.toUpperCase() === "APPROVED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
      }`}
    >
      {status} · ₫{Number(revenue).toLocaleString("vi-VN")}
    </span>
  );
}

function SourceBadge({ source, note }: { source: string | null; note: string | null }): React.ReactElement {
  const s = source ?? "webhook";
  const cls =
    s === "both"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : s === "api-reconcile"
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{s}</span>
      {note ? (
        <span title={note} aria-label={note} className="cursor-help text-amber-600">
          ⚠️
        </span>
      ) : null}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.round(h / 24);
  return `${days} ngày trước`;
}
