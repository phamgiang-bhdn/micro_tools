import type React from "react";
import { Layers, Eye, EyeOff, Database } from "lucide-react";
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
  CATEGORY_STATUS_OPTIONS,
  DEFAULT_PAGE_SIZE
} from "../../../lib/admin/constants";
import { CategoriesTable, type CategoryRow } from "./categories-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; status?: "ACTIVE" | "INACTIVE"; page?: string }>;
}

export default async function CategoriesPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { search = "", status = "", page = "1" } = await searchParams;
  const all = await adminGet<CategoryRow[]>("/admin/categories");

  const filtered = all.filter((c) => {
    if (status && c.status !== status) return false;
    if (search) {
      const needle = search.toLowerCase();
      return c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle);
    }
    return true;
  });

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(filtered, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const qs = new URLSearchParams();
    if (search) qs.set(ADMIN_PARAMS.search, search);
    if (status) qs.set(ADMIN_PARAMS.status, status);
    if (p > 1) qs.set(ADMIN_PARAMS.page, String(p));
    const s = qs.toString();
    return `/admin/categories${s ? `?${s}` : ""}`;
  };

  const active = all.filter((c) => c.status === "ACTIVE").length;
  const inactive = all.length - active;
  const totalProducts = all.reduce((acc, c) => acc + c._count.products, 0);

  return (
    <ListPageShell
      eyebrow="Cấu hình"
      title="Danh mục"
      subtitle={
        <>
          Mỗi danh mục là một niche micro-tool.{" "}
          <code className="rounded bg-admin-subtle px-1 py-0.5 text-xs">schemaConfig</code> định
          nghĩa field AI bóc tách cho sản phẩm trong niche đó.
        </>
      }
      overview={[
        {
          label: "Tổng danh mục",
          value: all.length.toLocaleString("vi-VN"),
          icon: <Layers className="size-4" />
        },
        {
          label: "Đang hiện",
          value: active.toLocaleString("vi-VN"),
          tone: "success",
          icon: <Eye className="size-4" />
        },
        {
          label: "Ẩn",
          value: inactive.toLocaleString("vi-VN"),
          tone: "neutral",
          icon: <EyeOff className="size-4" />
        },
        {
          label: "Sản phẩm",
          value: totalProducts.toLocaleString("vi-VN"),
          icon: <Database className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/categories">
          <NativeFilterInput
            label="Tìm tên / slug"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="robot-hut-bui..."
          />
          <NativeFilterSelect
            label="Trạng thái"
            name={ADMIN_PARAMS.status}
            defaultValue={status}
            options={CATEGORY_STATUS_OPTIONS}
          />
        </FilterBar>
      }
      table={
        <div>
          <CategoriesTable
            rows={items}
            filteredCount={filtered.length}
            totalCount={all.length}
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
