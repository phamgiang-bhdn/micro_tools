import type React from "react";
import { Megaphone, CheckCircle2, Pause, XCircle } from "lucide-react";
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
  CAMPAIGN_STATUS_OPTIONS,
  DEFAULT_PAGE_SIZE,
  NETWORK_OPTIONS,
  type AffiliateNetwork,
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
    page?: string;
  }>;
}

export default async function CampaignsPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const network = sp.network ?? "";
  const status = sp.status ?? "";
  const page = sp.page ?? "1";

  const qs = new URLSearchParams();
  if (search) qs.set(ADMIN_PARAMS.search, search);
  if (network) qs.set(ADMIN_PARAMS.network, network);
  if (status) qs.set(ADMIN_PARAMS.status, status);

  const path = `/admin/campaigns${qs.toString() ? `?${qs.toString()}` : ""}`;
  const all = await adminGet<CampaignRow[]>(path);

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

  return (
    <ListPageShell
      eyebrow="Doanh thu"
      title="Affiliate campaigns"
      subtitle="Mỗi campaign = 1 merchant từ Accesstrade. Campaign APPROVED là crawler tự pull. Niche admin gán tay vào sản phẩm sau."
      actions={<SyncFromAtButton />}
      overview={[
        {
          label: "Tổng",
          value: all.length.toLocaleString("vi-VN"),
          icon: <Megaphone className="size-4" />
        },
        {
          label: "Đã duyệt",
          value: (counts.APPROVED ?? 0).toLocaleString("vi-VN"),
          tone: "success",
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
      filter={
        <FilterBar resetHref="/admin/campaigns">
          <NativeFilterInput
            label="Tìm"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="tên, merchant, externalId..."
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
        all.length === 0 && !search && !network && !status ? (
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
