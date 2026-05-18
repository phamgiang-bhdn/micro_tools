import type React from "react";
import { FolderTree, BadgeCheck, BadgeAlert } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterInput,
  NativeFilterSelect,
  Pagination,
  paginateRows
} from "../../../components/admin/ui";
import { ADMIN_PARAMS, DEFAULT_PAGE_SIZE } from "../../../lib/admin/constants";
import { CategoriesTable, type CategoryRow } from "./categories-table";

export const dynamic = "force-dynamic";

const DISPLAY_NAME_FILTER_OPTIONS = [
  { value: "false", label: "Chưa đặt tên" },
  { value: "true", label: "Đã đặt tên" }
];

interface PageProps {
  searchParams: Promise<{ search?: string; hasDisplayName?: "true" | "false"; page?: string }>;
}

export default async function CategoriesPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { search = "", hasDisplayName = "", page = "1" } = await searchParams;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (hasDisplayName) qs.set("hasDisplayName", hasDisplayName);
  const path = `/admin/categories${qs.toString() ? `?${qs.toString()}` : ""}`;
  const all = await adminGet<CategoryRow[]>(path);

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(all, pageNum, DEFAULT_PAGE_SIZE);

  const buildHref = (p: number): string => {
    const next = new URLSearchParams();
    if (search) next.set(ADMIN_PARAMS.search, search);
    if (hasDisplayName) next.set("hasDisplayName", hasDisplayName);
    if (p > 1) next.set(ADMIN_PARAMS.page, String(p));
    const s = next.toString();
    return `/admin/categories${s ? `?${s}` : ""}`;
  };

  const named = all.filter((c) => Boolean(c.displayName)).length;
  const unnamed = all.length - named;

  return (
    <ListPageShell
      eyebrow="Catalog"
      title="Category (AT taxonomy)"
      subtitle={
        <>
          Bucket phân loại từ Accesstrade — crawler tự upsert khi import offer (theo
          field <code className="rounded bg-admin-subtle px-1 py-0.5 text-xs">offer.cate</code>).
          Điền <span className="font-medium">displayName</span> để storefront/filter hiển thị tên đẹp.
        </>
      }
      overview={[
        {
          label: "Tổng",
          value: all.length.toLocaleString("vi-VN"),
          icon: <FolderTree className="size-4" />
        },
        {
          label: "Đã đặt tên",
          value: named.toLocaleString("vi-VN"),
          tone: "success",
          icon: <BadgeCheck className="size-4" />
        },
        {
          label: "Chưa đặt tên",
          value: unnamed.toLocaleString("vi-VN"),
          tone: "warning",
          icon: <BadgeAlert className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/categories">
          <NativeFilterInput
            label="Tìm slug / rawValue / displayName"
            name={ADMIN_PARAMS.search}
            defaultValue={search}
            placeholder="dien-tu, tivi, ..."
          />
          <NativeFilterSelect
            label="Trạng thái displayName"
            name="hasDisplayName"
            defaultValue={hasDisplayName}
            options={DISPLAY_NAME_FILTER_OPTIONS}
          />
        </FilterBar>
      }
      table={
        <div>
          <CategoriesTable rows={items} totalCount={all.length} />
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
