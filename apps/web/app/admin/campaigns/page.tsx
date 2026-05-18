import type React from "react";
import { Megaphone, CheckCircle2, Pause, XCircle, FolderTree } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterInput,
  NativeFilterSelect,
  Pagination,
  paginateRows,
  AdminEmptyState
} from "../../../components/admin/ui";
import {
  ADMIN_PARAMS,
  CAMPAIGN_ASSIGNMENT_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  DEFAULT_PAGE_SIZE,
  NETWORK_OPTIONS,
  type AffiliateNetwork,
  type CampaignAssignment,
  type CampaignStatus
} from "../../../lib/admin/constants";
import { CampaignsTable, type CampaignRow } from "./campaigns-table";
import { SyncFromAtButton } from "./sync-from-at-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    network?: AffiliateNetwork;
    status?: CampaignStatus;
    assignment?: CampaignAssignment;
    page?: string;
  }>;
}

interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export default async function CampaignsPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const network = sp.network ?? "";
  const status = sp.status ?? "";
  const assignment: CampaignAssignment = (sp.assignment ?? "") as CampaignAssignment;
  const page = sp.page ?? "1";

  const qs = new URLSearchParams();
  if (search) qs.set(ADMIN_PARAMS.search, search);
  if (network) qs.set(ADMIN_PARAMS.network, network);
  if (status) qs.set(ADMIN_PARAMS.status, status);
  if (assignment) qs.set(ADMIN_PARAMS.assignment, assignment);

  const apiQs = new URLSearchParams(qs.toString());
  // Backend dùng cùng key, không cần map.
  const path = `/admin/campaigns${apiQs.toString() ? `?${apiQs.toString()}` : ""}`;

  const [all, categories] = await Promise.all([
    adminGet<CampaignRow[]>(path),
    adminGet<CategorySummary[]>("/admin/categories")
  ]);

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(all, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const next = new URLSearchParams(qs.toString());
    if (p > 1) next.set(ADMIN_PARAMS.page, String(p));
    else next.delete(ADMIN_PARAMS.page);
    const s = next.toString();
    return `/admin/campaigns${s ? `?${s}` : ""}`;
  };

  const counts = all.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<CampaignStatus, number>
  );
  const assignedCount = all.filter((c) => c.assignments.length > 0).length;

  return (
    <ListPageShell
      eyebrow="Doanh thu"
      title="Affiliate campaigns"
      subtitle="Mỗi campaign = 1 merchant từ Accesstrade. Sync → assign vào Category → crawler tự pull theo filter rules per-campaign."
      actions={<SyncFromAtButton />}
      overview={[
        {
          label: "Tổng",
          value: all.length.toLocaleString("vi-VN"),
          icon: <Megaphone className="size-4" />
        },
        {
          label: "Đã assign",
          value: assignedCount.toLocaleString("vi-VN"),
          tone: "success",
          icon: <FolderTree className="size-4" />
        },
        {
          label: "Đã duyệt",
          value: (counts.APPROVED ?? 0).toLocaleString("vi-VN"),
          tone: "info",
          icon: <CheckCircle2 className="size-4" />
        },
        {
          label: "Tạm dừng / ngừng",
          value: ((counts.PAUSED ?? 0) + (counts.INACTIVE ?? 0)).toLocaleString("vi-VN"),
          tone: "warning",
          icon: <Pause className="size-4" />
        },
        {
          label: "Từ chối",
          value: (counts.REJECTED ?? 0).toLocaleString("vi-VN"),
          tone: "danger",
          icon: <XCircle className="size-4" />
        }
      ]}
      overviewCols={5}
      filter={
        <FilterBar resetHref="/admin/campaigns">
          <NativeFilterInput
            label="Tìm"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="tên, merchant, externalId..."
          />
          <NativeFilterSelect
            label="Assignment"
            name={ADMIN_PARAMS.assignment}
            defaultValue={assignment}
            options={CAMPAIGN_ASSIGNMENT_OPTIONS}
          />
          <NativeFilterSelect
            label="Mạng"
            name={ADMIN_PARAMS.network}
            defaultValue={network}
            options={NETWORK_OPTIONS}
          />
          <NativeFilterSelect
            label="Trạng thái"
            name={ADMIN_PARAMS.status}
            defaultValue={status}
            options={CAMPAIGN_STATUS_OPTIONS}
          />
        </FilterBar>
      }
      table={
        all.length === 0 && !search && !network && !status && !assignment ? (
          <AdminEmptyState
            icon={<Megaphone />}
            title="Chưa có campaign nào"
            description="Apply campaign trên https://pub2.accesstrade.vn → đợi duyệt → bấm Sync from Accesstrade ở trên để pull về DB."
          />
        ) : (
          <div>
            <CampaignsTable
              rows={items}
              filteredCount={all.length}
              totalCount={all.length}
              categories={categories}
            />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              buildHref={buildHref}
              total={all.length}
              pageSize={DEFAULT_PAGE_SIZE}
            />
          </div>
        )
      }
    />
  );
}
