import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, MousePointerClick, ShoppingBag, TrendingUp } from "lucide-react";
import { adminGet, ListPageShell, StatusPill } from "../../../../../components/admin/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}

interface AnalyticsResponse {
  tool: {
    id: string;
    name: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    niche: { slug: string; name: string };
  };
  periodDays: number;
  since: string;
  totals: {
    sessionsAllTime: number;
    sessionsInRange: number;
    chatSessions: number;
    quizSessions: number;
    clicks: number;
    conversions: number;
    clickRate: number;
    conversionRate: number;
  };
  bySource: { source: string; count: number }[];
  topProducts: { productId: string; name: string; slug: string | null; clicks: number }[];
}

export default async function ToolAnalyticsPage({
  params,
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const { days = "30" } = await searchParams;

  let data: AnalyticsResponse;
  try {
    data = await adminGet<AnalyticsResponse>(`/admin/tools/${id}/analytics?days=${days}`);
  } catch {
    notFound();
  }

  return (
    <ListPageShell
      eyebrow={`Tool · ${data.tool.niche.name}`}
      title={`Analytics: ${data.tool.name}`}
      subtitle={
        <span>
          {data.periodDays} ngày qua · từ {new Date(data.since).toLocaleDateString("vi-VN")}
          {" · "}
          <Link href={`/admin/tools/${id}`} className="text-admin-accent hover:underline">
            ← Quay lại edit
          </Link>
        </span>
      }
      overview={[
        {
          label: "Sessions (period)",
          value: data.totals.sessionsInRange.toLocaleString("vi-VN"),
          icon: <Eye className="size-4" />
        },
        {
          label: "Clicks → affiliate",
          value: data.totals.clicks.toLocaleString("vi-VN"),
          tone: data.totals.clicks >= 50 ? "success" : "neutral",
          icon: <MousePointerClick className="size-4" />
        },
        {
          label: "Click rate",
          value: `${data.totals.clickRate}%`,
          tone: data.totals.clickRate >= 15 ? "success" : "neutral",
          icon: <TrendingUp className="size-4" />
        },
        {
          label: "Conversions",
          value: data.totals.conversions.toLocaleString("vi-VN"),
          tone: data.totals.conversions >= 5 ? "success" : "neutral",
          icon: <ShoppingBag className="size-4" />
        }
      ]}
      filter={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-admin-mute">Period:</span>
          {(["7", "30", "90"] as const).map((d) => (
            <Link
              key={d}
              href={`/admin/tools/${id}/analytics?days=${d}`}
              className={
                days === d
                  ? "rounded-full bg-admin-accent px-3 py-1 font-medium text-white"
                  : "rounded-full border border-admin-line px-3 py-1 text-admin-ink hover:border-admin-accent"
              }
            >
              {d} ngày
            </Link>
          ))}
        </div>
      }
      table={
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-admin-line bg-admin-surface p-5">
            <h3 className="text-sm font-semibold text-admin-ink">Funnel breakdown</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <FunnelRow label="Sessions (all time)" value={data.totals.sessionsAllTime} />
              <FunnelRow label="Sessions (period)" value={data.totals.sessionsInRange} />
              <FunnelRow
                label="↳ Chat mode"
                value={data.totals.chatSessions}
                pct={pct(data.totals.chatSessions, data.totals.sessionsInRange)}
              />
              <FunnelRow
                label="↳ Quiz mode"
                value={data.totals.quizSessions}
                pct={pct(data.totals.quizSessions, data.totals.sessionsInRange)}
              />
              <FunnelRow
                label="→ Click affiliate"
                value={data.totals.clicks}
                pct={data.totals.clickRate}
                highlight={data.totals.clickRate >= 15}
              />
              <FunnelRow
                label="→ Conversion (paid)"
                value={data.totals.conversions}
                pct={data.totals.conversionRate}
                highlight={data.totals.conversionRate >= 1}
              />
            </ul>
            <p className="mt-4 text-xs text-admin-mute">
              Target gate: ≥15% click rate · ≥1% conversion rate · ≥5 conversion / tuần.
            </p>
          </section>

          <section className="rounded-2xl border border-admin-line bg-admin-surface p-5">
            <h3 className="text-sm font-semibold text-admin-ink">Source breakdown</h3>
            {data.bySource.length === 0 ? (
              <p className="mt-3 text-sm text-admin-mute">Chưa có session nào trong period.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {data.bySource.map((s) => (
                  <li key={s.source} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-admin-ink">{s.source}</span>
                    <StatusPill tone="neutral">{s.count.toLocaleString("vi-VN")}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-admin-mute">
              Add <code className="font-mono">?source=tiktok-v1</code> đến URL để track per-channel.
            </p>
          </section>

          <section className="rounded-2xl border border-admin-line bg-admin-surface p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-admin-ink">Top 5 product được click</h3>
            {data.topProducts.length === 0 ? (
              <p className="mt-3 text-sm text-admin-mute">Chưa có click nào trong period.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {data.topProducts.map((p, idx) => (
                  <li key={p.productId} className="flex items-center justify-between gap-3 rounded-lg bg-admin-bg p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-xs text-admin-mute">#{idx + 1}</span>
                      <span className="truncate font-medium text-admin-ink">{p.name}</span>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-admin-accent">
                      {p.clicks.toLocaleString("vi-VN")} clicks
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      }
    />
  );
}

function FunnelRow({
  label,
  value,
  pct,
  highlight
}: {
  label: string;
  value: number;
  pct?: number;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <li className="flex items-center justify-between rounded-lg border border-admin-line bg-admin-bg p-3">
      <span className="text-admin-ink">{label}</span>
      <span className={`font-mono text-sm font-semibold ${highlight ? "text-green-700" : "text-admin-ink"}`}>
        {value.toLocaleString("vi-VN")}
        {pct !== undefined && pct > 0 && <span className="ml-2 text-xs text-admin-mute">({pct}%)</span>}
      </span>
    </li>
  );
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}
