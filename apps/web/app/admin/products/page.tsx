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
    nicheStatus?: "assigned" | "unassigned";
    categoryId?: string;
    sourceId?: string;
    brandId?: string;
    network?: string;
    isPublic?: string;
    search?: string;
    page?: string;
  }>;
}

const NICHE_STATUS_OPTIONS = [
  { value: "unassigned", label: "Chưa gán niche" },
  { value: "assigned", label: "Đã gán niche" }
];

interface LookupLite {
  id: string;
  slug: string;
  rawValue: string;
  displayName: string | null;
  _count: { products: number };
}

export default async function ProductsPage({
  searchParams
}: ProductsPageProps): Promise<React.ReactElement> {
  const filters = await searchParams;
  const qs = new URLSearchParams();
  if (filters.nicheId) qs.set("nicheId", filters.nicheId);
  if (filters.nicheStatus) qs.set("nicheStatus", filters.nicheStatus);
  if (filters.categoryId) qs.set("categoryId", filters.categoryId);
  if (filters.sourceId) qs.set("sourceId", filters.sourceId);
  if (filters.brandId) qs.set("brandId", filters.brandId);
  if (filters.network) qs.set(ADMIN_PARAMS.network, filters.network);
  if (filters.isPublic) qs.set(ADMIN_PARAMS.isPublic, filters.isPublic);
  if (filters.search) qs.set(ADMIN_PARAMS.search, filters.search);
  qs.set("limit", "500");

  const [products, niches, categories, sources, brands] = await Promise.all([
    adminGet<ProductRow[]>(`/admin/products?${qs.toString()}`),
    adminGet<NicheLite[]>("/admin/niches"),
    adminGet<LookupLite[]>("/admin/categories"),
    adminGet<LookupLite[]>("/admin/sources"),
    adminGet<LookupLite[]>("/admin/brands")
  ]);

  const pageNum = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const { items, totalPages, safePage } = paginateRows(products, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (filters.nicheId) params.set("nicheId", filters.nicheId);
    if (filters.nicheStatus) params.set("nicheStatus", filters.nicheStatus);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.sourceId) params.set("sourceId", filters.sourceId);
    if (filters.brandId) params.set("brandId", filters.brandId);
    if (filters.network) params.set(ADMIN_PARAMS.network, filters.network);
    if (filters.isPublic) params.set(ADMIN_PARAMS.isPublic, filters.isPublic);
    if (filters.search) params.set(ADMIN_PARAMS.search, filters.search);
    if (p > 1) params.set(ADMIN_PARAMS.page, String(p));
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  const hasFilter = Boolean(
    filters.search ||
      filters.nicheId ||
      filters.nicheStatus ||
      filters.categoryId ||
      filters.sourceId ||
      filters.brandId ||
      filters.network ||
      filters.isPublic
  );

  const publicCount = products.filter((p) => p.isPublic).length;
  const hidden = products.length - publicCount;
  const networkCount = new Set(products.map((p) => p.network)).size;

  const nicheOptions = niches.map((c) => ({ value: c.id, label: c.name }));
  const lookupToOption = (c: LookupLite): { value: string; label: string } => ({
    value: c.id,
    label: c.displayName
      ? `${c.displayName} (${c._count.products})`
      : `${c.rawValue} — chưa đặt tên (${c._count.products})`
  });
  const categoryOptions = categories.map(lookupToOption);
  const sourceOptions = sources.map(lookupToOption);
  const brandOptions = brands.map(lookupToOption);

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
            label="Trạng thái niche"
            name="nicheStatus"
            defaultValue={filters.nicheStatus ?? ""}
            options={NICHE_STATUS_OPTIONS}
          />
          <NativeFilterSelect
            label="Niche"
            name="nicheId"
            defaultValue={filters.nicheId ?? ""}
            options={nicheOptions}
          />
          <NativeFilterSelect
            label="Category (AT)"
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            options={categoryOptions}
          />
          <NativeFilterSelect
            label="Nguồn bán"
            name="sourceId"
            defaultValue={filters.sourceId ?? ""}
            options={sourceOptions}
          />
          <NativeFilterSelect
            label="Thương hiệu"
            name="brandId"
            defaultValue={filters.brandId ?? ""}
            options={brandOptions}
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
