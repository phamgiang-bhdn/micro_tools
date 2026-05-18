import type React from "react";
import { Store, Boxes } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterInput,
  Pagination,
  paginateRows
} from "../../../components/admin/ui";
import { ADMIN_PARAMS, DEFAULT_PAGE_SIZE } from "../../../lib/admin/constants";
import { ShopsTable, type ShopRow } from "./shops-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function ShopsPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { search = "", page = "1" } = await searchParams;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  const path = `/admin/shops${qs.toString() ? `?${qs.toString()}` : ""}`;
  const all = await adminGet<ShopRow[]>(path);

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(all, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const next = new URLSearchParams();
    if (search) next.set(ADMIN_PARAMS.search, search);
    if (p > 1) next.set(ADMIN_PARAMS.page, String(p));
    const s = next.toString();
    return `/admin/shops${s ? `?${s}` : ""}`;
  };

  const totalProducts = all.reduce((acc, s) => acc + s._count.products, 0);

  return (
    <ListPageShell
      eyebrow="Danh mục"
      title="Cửa hàng"
      subtitle="Cửa hàng admin tự tạo + gán tay cho sản phẩm — hiện trên storefront thay cho campaign."
      overview={[
        {
          label: "Tổng shop",
          value: all.length.toLocaleString("vi-VN"),
          icon: <Store className="size-4" />
        },
        {
          label: "Sản phẩm đã gán",
          value: totalProducts.toLocaleString("vi-VN"),
          icon: <Boxes className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/shops">
          <NativeFilterInput
            label="Tìm tên / slug"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="Shopee, lazada-vn, ..."
          />
        </FilterBar>
      }
      table={
        <div>
          <ShopsTable rows={items} totalCount={all.length} />
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
