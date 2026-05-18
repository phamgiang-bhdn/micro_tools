import type React from "react";
import { Ticket, Power, PowerOff, Clock } from "lucide-react";
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
  ACTIVE_TOGGLE_OPTIONS,
  ADMIN_PARAMS,
  DEFAULT_PAGE_SIZE,
  NETWORK_OPTIONS
} from "../../../lib/admin/constants";
import { CouponsTable, type CouponRow, type CategoryLite } from "./coupons-table";
import { SyncCouponsFromAtButton } from "./sync-coupons-from-at-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    isActive?: string;
    network?: string;
    merchantSlug?: string;
    page?: string;
  }>;
}

export default async function CouponsPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const {
    search = "",
    isActive = "",
    network = "",
    merchantSlug = "",
    page = "1"
  } = await searchParams;

  const [allCoupons, categories] = await Promise.all([
    adminGet<CouponRow[]>("/admin/coupons"),
    adminGet<CategoryLite[]>("/admin/categories")
  ]);

  const filtered = allCoupons.filter((c) => {
    if (isActive === "true" && !c.isActive) return false;
    if (isActive === "false" && c.isActive) return false;
    if (network && c.network !== network) return false;
    if (merchantSlug && c.merchantSlug !== merchantSlug) return false;
    if (search) {
      const n = search.toLowerCase();
      const hit =
        c.code.toLowerCase().includes(n) ||
        (c.description ?? "").toLowerCase().includes(n) ||
        (c.product?.name ?? "").toLowerCase().includes(n) ||
        (c.category?.name ?? "").toLowerCase().includes(n) ||
        (c.merchantDisplay ?? "").toLowerCase().includes(n);
      if (!hit) return false;
    }
    return true;
  });

  const merchantOptions = Array.from(
    new Map(
      allCoupons
        .filter((c) => c.merchantSlug)
        .map((c) => [c.merchantSlug as string, c.merchantDisplay ?? c.merchantSlug])
    ).entries()
  )
    .sort(([, a], [, b]) => String(a).localeCompare(String(b)))
    .map(([value, label]) => ({ value, label: String(label) }));

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(filtered, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (search) params.set(ADMIN_PARAMS.search, search);
    if (isActive) params.set(ADMIN_PARAMS.isActive, isActive);
    if (network) params.set(ADMIN_PARAMS.network, network);
    if (merchantSlug) params.set("merchantSlug", merchantSlug);
    if (p > 1) params.set(ADMIN_PARAMS.page, String(p));
    const s = params.toString();
    return `/admin/coupons${s ? `?${s}` : ""}`;
  };

  // Overview stats — đếm trực tiếp trên allCoupons.
  const now = Date.now();
  const active = allCoupons.filter((c) => c.isActive).length;
  const disabled = allCoupons.length - active;
  const expiringSoon = allCoupons.filter((c) => {
    if (!c.isActive || !c.expiresAt) return false;
    const ms = new Date(c.expiresAt).getTime() - now;
    return ms > 0 && ms < 7 * 24 * 3600 * 1000;
  }).length;

  return (
    <ListPageShell
      eyebrow="Khuyến mãi"
      title="Mã giảm giá"
      subtitle="Coupon có thể gắn theo network, danh mục hoặc sản phẩm cụ thể. Mã không nhập sẽ áp toàn site."
      overview={[
        {
          label: "Tổng mã",
          value: allCoupons.length.toLocaleString("vi-VN"),
          icon: <Ticket className="size-4" />
        },
        {
          label: "Đang chạy",
          value: active.toLocaleString("vi-VN"),
          tone: "success",
          icon: <Power className="size-4" />
        },
        {
          label: "Tạm tắt",
          value: disabled.toLocaleString("vi-VN"),
          tone: "neutral",
          icon: <PowerOff className="size-4" />
        },
        {
          label: "Sắp hết hạn (≤7 ngày)",
          value: expiringSoon.toLocaleString("vi-VN"),
          tone: expiringSoon > 0 ? "warning" : "neutral",
          icon: <Clock className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/coupons" extraActions={<SyncCouponsFromAtButton />}>
          <NativeFilterInput
            label="Tìm mã / mô tả / merchant"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="SUMMER..."
          />
          <NativeFilterSelect
            label="Trạng thái"
            name={ADMIN_PARAMS.isActive}
            defaultValue={isActive}
            options={ACTIVE_TOGGLE_OPTIONS}
          />
          <NativeFilterSelect
            label="Network"
            name={ADMIN_PARAMS.network}
            defaultValue={network}
            options={NETWORK_OPTIONS}
          />
          {merchantOptions.length > 0 ? (
            <NativeFilterSelect
              label="Merchant"
              name="merchantSlug"
              defaultValue={merchantSlug}
              options={merchantOptions}
            />
          ) : null}
        </FilterBar>
      }
      table={
        <div>
          <CouponsTable
            rows={items}
            categories={categories}
            filteredCount={filtered.length}
            totalCount={allCoupons.length}
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
