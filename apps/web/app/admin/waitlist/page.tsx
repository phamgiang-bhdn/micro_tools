import type React from "react";
import { Mail, TrendingUp, Globe2, ListChecks } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterInput,
  Pagination,
  paginateRows
} from "../../../components/admin/ui";
import { ADMIN_PARAMS, DEFAULT_PAGE_SIZE } from "../../../lib/admin/constants";
import { WaitlistTable, type WaitlistRow } from "./waitlist-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; nicheSlug?: string; page?: string }>;
}

interface WaitlistStats {
  total: number;
  recent7d: number;
  byNiche: { nicheSlug: string; count: number }[];
  bySource: { source: string; count: number }[];
  bySurvey: { answer: string; count: number }[];
}

export default async function WaitlistPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { search = "", nicheSlug = "", page = "1" } = await searchParams;

  const [allRows, stats] = await Promise.all([
    adminGet<WaitlistRow[]>(
      `/admin/waitlist${nicheSlug ? `?nicheSlug=${encodeURIComponent(nicheSlug)}&limit=500` : "?limit=500"}`
    ),
    adminGet<WaitlistStats>(
      `/admin/waitlist/stats${nicheSlug ? `?nicheSlug=${encodeURIComponent(nicheSlug)}` : ""}`
    )
  ]);

  const filtered = allRows.filter((r) => {
    if (search) {
      const needle = search.toLowerCase();
      return (
        r.email.toLowerCase().includes(needle) ||
        r.nicheSlug.toLowerCase().includes(needle) ||
        (r.source ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(filtered, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const qs = new URLSearchParams();
    if (search) qs.set(ADMIN_PARAMS.search, search);
    if (nicheSlug) qs.set("nicheSlug", nicheSlug);
    if (p > 1) qs.set(ADMIN_PARAMS.page, String(p));
    const s = qs.toString();
    return `/admin/waitlist${s ? `?${s}` : ""}`;
  };

  const topNiche = stats.byNiche[0];
  const topSource = stats.bySource.find((s) => s.source !== "(unknown)") ?? stats.bySource[0];

  return (
    <ListPageShell
      eyebrow="Epic 0 — Pre-launch"
      title="Waitlist signups"
      subtitle="Validate demand trước khi build full tool. Gate: ≥50 email/7 ngày → tiếp Epic 1."
      overview={[
        {
          label: "Tổng email",
          value: stats.total.toLocaleString("vi-VN"),
          icon: <Mail className="size-4" />
        },
        {
          label: "7 ngày qua",
          value: stats.recent7d.toLocaleString("vi-VN"),
          tone: stats.recent7d >= 50 ? "success" : "neutral",
          icon: <TrendingUp className="size-4" />
        },
        {
          label: "Niche hot nhất",
          value: topNiche ? `${topNiche.nicheSlug} (${topNiche.count})` : "—",
          icon: <ListChecks className="size-4" />
        },
        {
          label: "Source hot nhất",
          value: topSource ? `${topSource.source} (${topSource.count})` : "—",
          icon: <Globe2 className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/waitlist">
          <NativeFilterInput
            label="Tìm email / niche / source"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="user@example.com..."
          />
          <NativeFilterInput
            label="Lọc theo niche slug"
            name="nicheSlug"
            defaultValue={nicheSlug}
            placeholder="may-loc-nuoc"
          />
        </FilterBar>
      }
      table={
        <div>
          <WaitlistTable
            rows={items}
            filteredCount={filtered.length}
            totalCount={allRows.length}
            surveyBreakdown={stats.bySurvey}
            sourceBreakdown={stats.bySource}
          />
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={buildHref}
            total={filtered.length}
            pageSize={DEFAULT_PAGE_SIZE}
          />
        </div>
      }
    />
  );
}
