"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink } from "lucide-react";
import {
  AdminButton,
  ControlledTextField,
  ControlledTextareaField,
  DataTable,
  FormDialog,
  RowActions,
  type ColumnDef
} from "../../../components/admin/ui";
import {
  shopCreateSchema,
  shopUpdateSchema,
  type ShopCreateInput,
  type ShopUpdateInput
} from "../../../lib/admin/schemas";
import {
  createShopAction,
  updateShopAction,
  deleteShopAction
} from "../actions";
import { withToast } from "../../../lib/admin/notify";

export interface ShopRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { products: number };
}

interface ShopsTableProps {
  rows: ShopRow[];
  totalCount: number;
}

const EMPTY_CREATE: ShopCreateInput = {
  name: "",
  slug: "",
  description: null,
  logoUrl: null,
  websiteUrl: null
};

export function ShopsTable({ rows, totalCount }: ShopsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ShopRow | null>(null);

  const handleCreate = async (data: ShopCreateInput) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    if (data.description) fd.set("description", data.description);
    if (data.logoUrl) fd.set("logoUrl", data.logoUrl);
    if (data.websiteUrl) fd.set("websiteUrl", data.websiteUrl);
    await createShopAction(fd);
    router.refresh();
    return { ok: true as const };
  };

  const handleUpdate = async (data: ShopUpdateInput) => {
    if (!editing) return { ok: false as const, error: "Mất context shop đang sửa" };
    const fd = new FormData();
    fd.set("id", editing.id);
    if (data.name !== undefined) fd.set("name", data.name ?? "");
    if (data.slug !== undefined) fd.set("slug", data.slug ?? "");
    if (data.description !== undefined) fd.set("description", data.description ?? "");
    if (data.logoUrl !== undefined) fd.set("logoUrl", data.logoUrl ?? "");
    if (data.websiteUrl !== undefined) fd.set("websiteUrl", data.websiteUrl ?? "");
    await updateShopAction(fd);
    router.refresh();
    return { ok: true as const };
  };

  const handleDelete = async (id: string, name: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await withToast(
      async () => {
        await deleteShopAction(fd);
        router.refresh();
        return true;
      },
      {
        loading: `Đang xoá shop "${name}"…`,
        success: `Đã xoá shop "${name}"`,
        error: (e) => (e instanceof Error ? e.message : "Xoá shop thất bại")
      }
    );
  };

  const columns: ColumnDef<ShopRow>[] = [
    {
      key: "shop",
      header: "Shop",
      cell: (s) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.logoUrl}
              alt={s.name}
              className="size-8 shrink-0 rounded-md border border-admin-line object-cover"
            />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-admin-subtle text-xs font-semibold text-admin-mute">
              {s.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <button
              type="button"
              className="text-left font-medium text-admin-ink transition hover:text-admin-accent"
              onClick={() => setEditing(s)}
            >
              {s.name}
            </button>
            <div className="mt-0.5 font-mono text-[11px] text-admin-mute">{s.slug}</div>
          </div>
        </div>
      )
    },
    {
      key: "website",
      header: "Website",
      hideOnMobile: true,
      cell: (s) =>
        s.websiteUrl ? (
          <a
            href={s.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
          >
            <ExternalLink className="size-3" />
            <span className="truncate">{stripScheme(s.websiteUrl)}</span>
          </a>
        ) : (
          <span className="text-admin-mute">—</span>
        )
    },
    {
      key: "products",
      header: "Sản phẩm",
      align: "right",
      cell: (s) => <span className="font-semibold text-admin-ink">{s._count.products}</span>
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "100px",
      cell: (s) => {
        const lock = s._count.products > 0;
        return (
          <RowActions
            onEdit={() => setEditing(s)}
            onDelete={lock ? undefined : () => handleDelete(s.id, s.name)}
            deleteConfirm={`Xoá shop "${s.name}"? Hành động không thể hoàn tác.`}
            deleteDisabled={lock}
            deleteDisabledReason={`Có ${s._count.products} sản phẩm — bỏ gán shop khỏi sản phẩm trước`}
          />
        );
      }
    }
  ];

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/40 px-4 py-2.5">
          <span className="text-xs text-admin-mute">
            {totalCount.toLocaleString("vi-VN")} shop
          </span>
          <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
            Tạo shop
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          emptyState="Chưa có shop nào. Bấm 'Tạo shop' để thêm."
        />
      </div>

      <FormDialog<ShopCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo shop mới"
        description="Cửa hàng để gán cho sản phẩm. Slug duy nhất, dùng để route nội bộ."
        size="lg"
        schema={shopCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo shop"
      >
        <ShopFields />
      </FormDialog>

      <FormDialog<ShopUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Sửa shop "${editing.name}"` : "Sửa shop"}
        size="lg"
        schema={shopUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu"
      >
        <ShopFields editing />
      </FormDialog>
    </>
  );
}

function ShopFields({ editing }: { editing?: boolean } = {}): React.ReactElement {
  return (
    <>
      <ControlledTextField<ShopCreateInput>
        name="name"
        label="Tên shop"
        required
        placeholder="Shopee Mall"
      />
      <ControlledTextField<ShopCreateInput>
        name="slug"
        label="Slug (kebab-case)"
        required
        mono
        placeholder="shopee-mall"
        disabled={editing}
        hint={editing ? "Đổi slug có thể phá link nội bộ." : undefined}
      />
      <ControlledTextField<ShopCreateInput>
        name="websiteUrl"
        label="Website URL"
        placeholder="https://shopee.vn"
      />
      <ControlledTextField<ShopCreateInput>
        name="logoUrl"
        label="Logo URL"
        placeholder="https://..."
      />
      <ControlledTextareaField<ShopCreateInput>
        name="description"
        label="Mô tả"
        rows={3}
        fullRow
        placeholder="Mô tả ngắn về shop (optional)..."
      />
    </>
  );
}

function toFormValues(row: ShopRow): ShopUpdateInput {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl
  };
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
