import type React from "react";
import Link from "next/link";
import { KpiCard } from "../../../components/admin/kpi-card";
import {
  adminGet,
  AdminEmptyState,
  FilterBar,
  NetworkBadge,
  PageHeader,
  SectionCard
} from "../../../components/admin/ui";

export const dynamic = "force-dynamic";

interface AnalyticsOverview {
  window: { from: string; to: string };
  clicks: number;
  conversions: number;
  conversionRate: number;
  revenue: string;
  topProducts: Array<{ productId: string; name: string; network: string | null; clicks: number }>;
  productCountByCategory: Array<{ categoryId: string; name: string; slug: string; count: number }>;
  networkBreakdown: Array<{ network: string; revenue: string; count: number }>;
}

interface AnalyticsPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps): Promise<React.ReactElement> {
  const { from, to } = await searchParams;
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const data = await adminGet<AnalyticsOverview>(`/admin/analytics/overview?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phân tích"
        title="Thống kê"
        subtitle={
          <span>
            Khoảng: <span className="font-medium text-admin-ink">{dateFmt.format(new Date(data.window.from))}</span> →{" "}
            <span className="font-medium text-admin-ink">{dateFmt.format(new Date(data.window.to))}</span>
          </span>
        }
      />

      <FilterBar resetHref="/admin/analytics">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-admin-ink">Từ</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-10 rounded-lg border border-admin-line bg-admin-surface px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-admin-ink">Đến</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-10 rounded-lg border border-admin-line bg-admin-surface px-3 text-sm"
          />
        </div>
      </FilterBar>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng clicks" value={data.clicks.toLocaleString("vi-VN")} icon="rate" tone="neutral" />
        <KpiCard
          label="Đơn conversion"
          value={data.conversions.toLocaleString("vi-VN")}
          icon="rate"
          tone="accent"
        />
        <KpiCard
          label="Tỷ lệ chuyển đổi"
          value={`${data.conversionRate}%`}
          icon="rate"
          tone={data.conversionRate >= 2 ? "accent" : "neutral"}
        />
        <KpiCard
          label="Doanh thu"
          value={`₫${Number(data.revenue).toLocaleString("vi-VN")}`}
          icon="revenue"
          tone="brand"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Top 10 sản phẩm theo clicks">
          {data.topProducts.length === 0 ? (
            <AdminEmptyState title="Chưa có click nào" description="Khi user click vào nút deal, dữ liệu sẽ xuất hiện ở đây." />
          ) : (
            <ol className="space-y-2">
              {data.topProducts.map((p, idx) => (
                <li
                  key={p.productId}
                  className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-subtle/40 p-2.5"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-admin-accent text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <Link
                    href={`/admin/products/${p.productId}`}
                    className="line-clamp-1 flex-1 text-sm text-admin-ink hover:text-admin-accent"
                  >
                    {p.name}
                  </Link>
                  {p.network ? <NetworkBadge network={p.network} /> : null}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-admin-ink ring-1 ring-admin-line">
                    {p.clicks} clicks
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Doanh thu theo network">
          {data.networkBreakdown.length === 0 ? (
            <AdminEmptyState
              title="Chưa có conversion nào"
              description="Khoảng thời gian này chưa có đơn về."
            />
          ) : (
            <ul className="space-y-2">
              {data.networkBreakdown.map((n) => (
                <li
                  key={n.network}
                  className="flex items-center justify-between gap-3 rounded-lg border border-admin-line bg-admin-subtle/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <NetworkBadge network={n.network} />
                    <span className="text-xs text-admin-mute">{n.count} đơn</span>
                  </div>
                  <span className="font-semibold text-admin-ink">
                    ₫{Number(n.revenue).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title="Số sản phẩm public theo danh mục">
            {data.productCountByCategory.length === 0 ? (
              <AdminEmptyState title="Chưa có sản phẩm public" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.productCountByCategory.map((c) => (
                  <Link
                    key={c.categoryId}
                    href={`/admin/products?categoryId=${c.categoryId}`}
                    className="flex items-center justify-between rounded-lg border border-admin-line bg-admin-surface p-3 transition hover:border-admin-accent hover:bg-admin-accent-soft"
                  >
                    <span className="line-clamp-1 font-medium text-admin-ink">{c.name}</span>
                    <span className="rounded-full bg-admin-subtle px-2 py-0.5 text-xs font-bold text-admin-ink">
                      {c.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
