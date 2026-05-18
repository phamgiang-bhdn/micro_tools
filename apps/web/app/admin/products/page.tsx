import type React from "react";
import { Boxes, Eye, EyeOff, Network } from "lucide-react";
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
import { ProductsTable, type NicheLite, type ProductRow } from "./products-table";

export const dynamic = "force-dynamic";

interface ProductsPageProps {
  searchParams: Promise<{
    nicheId?: string;
    network?: string;
    isPublic?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({
  searchParams
}: ProductsPageProps): Promise<React.ReactElement> {
  const filters = await searchParams;
  const qs = new URLSearchParams();
  if (filters.nicheId) qs.set(ADMIN_PARAMS.niche, filters.nicheId);
  if (filters.network) qs.set(ADMIN_PARAMS.network, filters.network);
  if (filters.isPublic) qs.set(ADMIN_PARAMS.isPublic, filters.isPublic);
  if (filters.search) qs.set(ADMIN_PARAMS.search, filters.search);
  qs.set("limit", "500");

  const [products, niches] = await Promise.all([
    adminGet<ProductRow[]>(`/admin/products?${qs.toString()}`),
    adminGet<NicheLite[]>("/admin/niches")
  ]);

  const pageNum = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const { items, totalPages, safePage } = paginateRows(products, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (filters.nicheId) params.set(ADMIN_PARAMS.niche, filters.nicheId);
    if (filters.network) params.set(ADMIN_PARAMS.network, filters.network);
    if (filters.isPublic) params.set(ADMIN_PARAMS.isPublic, filters.isPublic);
    if (filters.search) params.set(ADMIN_PARAMS.search, filters.search);
    if (p > 1) params.set(ADMIN_PARAMS.page, String(p));
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  const hasFilter = Boolean(
    filters.search || filters.nicheId || filters.network || filters.isPublic
  );

  const publicCount = products.filter((p) => p.isPublic).length;
  const hidden = products.length - publicCount;
  const networkCount = new Set(products.map((p) => p.network)).size;

  const nicheOptions = niches.map((c) => ({ value: c.id, label: c.name }));

  return (
    <ListPageShell
      eyebrow="Catalog"
      title="Sản phẩm"
      subtitle="Quản lý sản phẩm crawler đã nạp. Toggle ẩn/hiện, sửa giá ở trang chi tiết."
      overview={[
        {
          label: "Tổng (theo lọc)",
          value: products.length.toLocaleString("vi-VN"),
          icon: <Boxes className="size-4" />
        },
        {
          label: "Đang hiện",
          value: publicCount.toLocaleString("vi-VN"),
          tone: "success",
          icon: <Eye className="size-4" />
        },
        {
          label: "Đang ẩn",
          value: hidden.toLocaleString("vi-VN"),
          tone: "neutral",
          icon: <EyeOff className="size-4" />
        },
        {
          label: "Network",
          value: networkCount.toLocaleString("vi-VN"),
          icon: <Network className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/products">
          <NativeFilterInput
            label="Tìm tên"
            name={ADMIN_PARAMS.search}
            defaultValue={filters.search ?? ""}
            placeholder="Tên sản phẩm..."
          />
          <NativeFilterSelect
            label="Niche"
            name={ADMIN_PARAMS.niche}
            defaultValue={filters.nicheId ?? ""}
            options={nicheOptions}
          />
          <NativeFilterSelect
            label="Network"
            name={ADMIN_PARAMS.network}
            defaultValue={filters.network ?? ""}
            options={NETWORK_OPTIONS}
          />
          <NativeFilterSelect
            label="Hiển thị"
            name={ADMIN_PARAMS.isPublic}
            defaultValue={filters.isPublic ?? ""}
            options={ACTIVE_TOGGLE_OPTIONS.map((o) => ({
              ...o,
              label: o.value === "true" ? "Đang hiện" : "Đang ẩn"
            }))}
          />
        </FilterBar>
      }
      table={
        <div>
          <ProductsTable
            rows={items}
            niches={niches}
            totalCount={products.length}
            hasFilter={hasFilter}
          />
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={buildHref}
            total={products.length}
            pageSize={DEFAULT_PAGE_SIZE}
          />
        </div>
      }
    />
  );
}
