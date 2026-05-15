import type React from "react";
import { Megaphone, CheckCircle2, Pause, XCircle } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterInput,
  NativeFilterSelect,
  Pagination,
  paginateRows
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
  const { search = "", network = "", status = "", page = "1" } = await searchParams;

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

  // Stats: count per status across the full (filtered server-side) result set.
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
      subtitle="Mỗi campaign = 1 merchant trên affiliate network. Crawler tự tạo row khi gặp campaign mới; admin sync trạng thái dựa trên dashboard publisher."
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
          label: "Tạm dừng",
          value: (counts.PAUSED ?? 0).toLocaleString("vi-VN"),
          tone: "warning",
          icon: <Pause className="size-4" />
        },
        {
          label: "Từ chối / ngừng",
          value: ((counts.REJECTED ?? 0) + (counts.INACTIVE ?? 0)).toLocaleString("vi-VN"),
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
        <div>
          <CampaignsTable rows={items} filteredCount={all.length} totalCount={all.length} />
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={buildHref}
            total={all.length}
            pageSize={DEFAULT_PAGE_SIZE}
          />
        </div>
      }
    />
  );
}
