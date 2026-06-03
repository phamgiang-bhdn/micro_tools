import type React from "react";
import Link from "next/link";
import { Layers, Sparkles, Eye, MousePointerClick } from "lucide-react";
import {
  adminGet,
  AdminLinkButton,
  FilterBar,
  ListPageShell,
  NativeFilterSelect,
  Pagination,
  paginateRows
} from "../../../components/admin/ui";
import { ADMIN_PARAMS, DEFAULT_PAGE_SIZE } from "../../../lib/admin/constants";
import { ToolsTable, type ToolRow } from "./tools-table";
import { AdminToolTriggers } from "./admin-triggers";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" }
];

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ToolsPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { status = "", page = "1" } = await searchParams;
  const all = await adminGet<ToolRow[]>(`/admin/tools${status ? `?status=${status}` : ""}`);
  const niches = await adminGet<{ id: string; slug: string; name: string; status: string }[]>(
    "/admin/niches"
  );

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(all, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (p > 1) qs.set(ADMIN_PARAMS.page, String(p));
    const s = qs.toString();
    return `/admin/tools${s ? `?${s}` : ""}`;
  };

  const published = all.filter((t) => t.status === "PUBLISHED").length;
  const draft = all.filter((t) => t.status === "DRAFT").length;
  const totalSessions = all.reduce((acc, t) => acc + (t._count?.sessions ?? 0), 0);
  const totalClicks = all.reduce((acc, t) => acc + (t._count?.clickLogs ?? 0), 0);

  return (
    <ListPageShell
      eyebrow="Epic 2 — AI Tool"
      title="Tool builder"
      subtitle="Mỗi Tool là 1 quiz/chat AI giúp user chọn sản phẩm. Niche-agnostic via Json config."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminToolTriggers />
          <AdminLinkButton href="/admin/tools/new" variant="brand">
            + Tạo Tool mới
          </AdminLinkButton>
        </div>
      }
      overview={[
        {
          label: "Tổng Tool",
          value: all.length.toLocaleString("vi-VN"),
          icon: <Layers className="size-4" />
        },
        {
          label: "Đang phát hành",
          value: published.toLocaleString("vi-VN"),
          tone: "success",
          icon: <Sparkles className="size-4" />
        },
        {
          label: "Tổng session",
          value: totalSessions.toLocaleString("vi-VN"),
          icon: <Eye className="size-4" />
        },
        {
          label: "Tổng click",
          value: totalClicks.toLocaleString("vi-VN"),
          icon: <MousePointerClick className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/tools">
          <NativeFilterSelect
            label="Status"
            name="status"
            defaultValue={status}
            options={STATUS_OPTIONS}
          />
        </FilterBar>
      }
      table={
        <div>
          <ToolsTable rows={items} niches={niches} />
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={buildHref}
            total={all.length}
            pageSize={DEFAULT_PAGE_SIZE}
          />
          <p className="mt-4 text-xs text-admin-mute">
            💡 Quiz schema + scoring rules dạng JSON. Phase 1: edit JSON tay trong detail page.
            Visual builder (Story 2.2) làm sau khi launch.
          </p>
        </div>
      }
    />
  );
}
