"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ExternalLink, Eye, EyeOff } from "lucide-react";
import {
  AdminButton,
  DataTable,
  FormDialog,
  RowActions,
  StatusPill,
  NetworkBadge,
  ControlledTextField,
  ControlledSelectField,
  ControlledCheckboxField,
  type ColumnDef
} from "../../../components/admin/ui";
import { NETWORK_OPTIONS, type AffiliateNetwork } from "../../../lib/admin/constants";
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput
} from "../../../lib/admin/schemas";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  toggleProductPublicAction
} from "../actions";

export interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  network: string;
  isPublic: boolean;
  affiliateUrl: string;
  updatedAt: string;
  category: { id: string; slug: string; name: string };
}

export interface CategoryLite {
  id: string;
  slug: string;
  name: string;
}

interface ProductsTableProps {
  rows: ProductRow[];
  categories: CategoryLite[];
  totalCount: number;
  hasFilter: boolean;
}

const EMPTY_CREATE: ProductCreateInput = {
  name: "",
  affiliateUrl: "",
  categoryId: "",
  network: "ACCESSTRADE",
  isPublic: false,
  scrapedData: undefined
};

export function ProductsTable({
  rows,
  categories,
  totalCount,
  hasFilter
}: ProductsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);

  const categoryOptions = React.useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  const handleCreate = async (data: ProductCreateInput) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("affiliateUrl", data.affiliateUrl);
    fd.set("categoryId", data.categoryId);
    fd.set("network", data.network);
    if (data.isPublic) fd.set("isPublic", "on");
    if (data.scrapedData) fd.set("scrapedData", data.scrapedData);
    await createProductAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleUpdate = async (data: ProductUpdateInput) => {
    if (!editing) return { ok: false, error: "Mất context sản phẩm đang sửa" };
    const fd = new FormData();
    fd.set("id", editing.id);
    if (data.name) fd.set("name", data.name);
    if (data.affiliateUrl) fd.set("affiliateUrl", data.affiliateUrl);
    if (data.categoryId) fd.set("categoryId", data.categoryId);
    if (data.network) fd.set("network", data.network);
    if (data.isPublic !== undefined) fd.set("isPublic", data.isPublic ? "true" : "false");
    await updateProductAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteProductAction(fd);
    router.refresh();
  };

  const handleTogglePublic = async (id: string, nextPublic: boolean) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("isPublic", String(nextPublic));
    await toggleProductPublicAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<ProductRow>[] = [
    {
      key: "name",
      header: "Tên",
      cell: (p) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setEditing(p)}
            className="line-clamp-1 text-left font-medium text-admin-ink transition hover:text-admin-accent"
          >
            {p.name}
          </button>
          {p.slug ? (
            <div className="mt-0.5 line-clamp-1 font-mono text-[11px] text-admin-mute">{p.slug}</div>
          ) : null}
        </div>
      )
    },
    {
      key: "category",
      header: "Danh mục",
      hideOnMobile: true,
      cell: (p) => <span className="text-admin-mute">{p.category.name}</span>
    },
    {
      key: "network",
      header: "Network",
      cell: (p) => <NetworkBadge network={p.network} />
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (p) =>
        p.isPublic ? (
          <StatusPill tone="success" dot>
            Hiện
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" dot>
            Ẩn
          </StatusPill>
        )
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
      cell: (p) => (
        <RowActions
          onEdit={() => setEditing(p)}
          onDelete={() => handleDelete(p.id)}
          deleteConfirm={`Xoá sản phẩm "${p.name}"? Hành động không thể hoàn tác.`}
          more={[
            {
              label: p.isPublic ? "Ẩn khỏi storefront" : "Hiện trên storefront",
              icon: p.isPublic ? <EyeOff /> : <Eye />,
              onSelect: () => handleTogglePublic(p.id, !p.isPublic)
            },
            ...(p.isPublic && p.slug
              ? [
                  {
                    label: "Xem trên storefront",
                    icon: <ExternalLink />,
                    onSelect: () => {
                      window.open(
                        `/categories/${p.category.slug}/${p.slug}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }
                  }
                ]
              : []),
            {
              label: "Sửa scrapedData (trang chi tiết)",
              icon: <ExternalLink />,
              onSelect: () => {
                window.location.href = `/admin/products/${p.id}`;
              }
            }
          ]}
        />
      )
    }
  ];

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/30 px-4 py-3">
          <div className="text-xs text-admin-mute">
            Đang hiển thị: <span className="font-semibold text-admin-ink">{rows.length}</span>
            {totalCount !== rows.length ? <span> / {totalCount}</span> : null}
            {hasFilter ? <span className="ml-1 text-admin-mute">(theo lọc)</span> : null}
          </div>
          <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
            Thêm sản phẩm
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          emptyState={hasFilter ? "Không có sản phẩm khớp bộ lọc." : "Chưa có sản phẩm nào."}
        />
      </div>

      <FormDialog<ProductCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Thêm sản phẩm thủ công"
        description="Thường crawler tự nạp — chỉ thêm tay khi cần override hoặc thử nghiệm."
        size="lg"
        schema={productCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo sản phẩm"
      >
        <ProductFields categoryOptions={categoryOptions} />
      </FormDialog>

      <FormDialog<ProductUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Sửa "${editing.name}"` : "Sửa sản phẩm"}
        size="lg"
        schema={productUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu"
      >
        <ProductFields categoryOptions={categoryOptions} editing />
        <Link
          href={editing ? `/admin/products/${editing.id}` : "#"}
          className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
        >
          <ExternalLink className="size-3" /> Sửa scrapedData (giá, ảnh, specs…) ở trang chi tiết
        </Link>
      </FormDialog>
    </>
  );
}

function ProductFields({
  categoryOptions,
  editing
}: {
  categoryOptions: Array<{ value: string; label: string }>;
  editing?: boolean;
}): React.ReactElement {
  return (
    <>
      <ControlledTextField<ProductCreateInput>
        name="name"
        label="Tên sản phẩm"
        required
        fullRow
        placeholder="Ecovacs Deebot X2 Omni"
      />
      <ControlledTextField<ProductCreateInput>
        name="affiliateUrl"
        label="URL affiliate"
        required
        fullRow
        placeholder="https://..."
        hint={editing ? "Đổi URL sẽ phá tracking cũ — chỉ đổi khi merchant đổi link." : undefined}
      />
      <ControlledSelectField<ProductCreateInput>
        name="categoryId"
        label="Danh mục"
        options={categoryOptions}
        required
      />
      <ControlledSelectField<ProductCreateInput>
        name="network"
        label="Network"
        options={NETWORK_OPTIONS}
        required
      />
      <ControlledCheckboxField<ProductCreateInput>
        name="isPublic"
        label="Hiển thị trên storefront ngay"
        hint="Tắt nếu chưa có đủ thông tin (giá, ảnh…). Vẫn đổi được sau ở dropdown ⋯."
        fullRow
      />
    </>
  );
}

function toFormValues(row: ProductRow): ProductUpdateInput {
  return {
    id: row.id,
    name: row.name,
    affiliateUrl: row.affiliateUrl,
    categoryId: row.category.id,
    network: row.network as AffiliateNetwork,
    isPublic: row.isPublic
  };
}
