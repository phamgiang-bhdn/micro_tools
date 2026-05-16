"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink } from "lucide-react";
import {
  AdminButton,
  DataTable,
  FormDialog,
  RowActions,
  StatusPill,
  ControlledTextField,
  ControlledTextareaField,
  ControlledSelectField,
  type ColumnDef
} from "../../../components/admin/ui";
import { CATEGORY_STATUS_OPTIONS } from "../../../lib/admin/constants";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type CategoryCreateInput,
  type CategoryUpdateInput
} from "../../../lib/admin/schemas";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction
} from "../actions";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _count: { products: number; articles: number };
}

interface CategoriesTableProps {
  rows: CategoryRow[];
  filteredCount: number;
  totalCount: number;
}

const DEFAULT_SCHEMA_JSON = `{
  "suctionPower": "number",
  "batteryMinutes": "number",
  "noiseLevel": "number"
}`;

const EMPTY_CREATE: CategoryCreateInput = {
  name: "",
  slug: "",
  schemaConfig: DEFAULT_SCHEMA_JSON,
  seoTitle: null,
  seoDescription: null
};

export function CategoriesTable({
  rows,
  filteredCount,
  totalCount
}: CategoriesTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);

  const handleCreate = async (data: CategoryCreateInput) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    fd.set("schemaConfig", data.schemaConfig);
    await createCategoryAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleUpdate = async (data: CategoryUpdateInput) => {
    if (!editing) return { ok: false, error: "Mất context danh mục đang sửa" };
    const fd = new FormData();
    fd.set("id", editing.id);
    if (data.name) fd.set("name", data.name);
    if (data.slug) fd.set("slug", data.slug);
    if (data.schemaConfig) fd.set("schemaConfig", data.schemaConfig);
    if (data.status) fd.set("status", data.status);
    if (data.seoTitle !== undefined) fd.set("seoTitle", data.seoTitle ?? "");
    if (data.seoDescription !== undefined) fd.set("seoDescription", data.seoDescription ?? "");
    await updateCategoryAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteCategoryAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: "name",
      header: "Tên",
      cell: (c) => (
        <div className="min-w-0">
          <button
            type="button"
            className="text-left font-medium text-admin-ink transition hover:text-admin-accent"
            onClick={() => setEditing(c)}
          >
            {c.name}
          </button>
          <div className="mt-0.5 font-mono text-[11px] text-admin-mute">{c.slug}</div>
        </div>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (c) =>
        c.status === "ACTIVE" ? (
          <StatusPill tone="success" dot>
            Đang hiện
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" dot>
            Ẩn
          </StatusPill>
        )
    },
    {
      key: "fields",
      header: "Số field",
      align: "right",
      hideOnMobile: true,
      cell: (c) => (
        <span className="font-mono text-xs text-admin-mute">
          {Object.keys(c.schemaConfig ?? {}).length}
        </span>
      )
    },
    {
      key: "products",
      header: "Sản phẩm",
      align: "right",
      cell: (c) => <span className="font-semibold text-admin-ink">{c._count.products}</span>
    },
    {
      key: "articles",
      header: "Bài viết",
      align: "right",
      hideOnMobile: true,
      cell: (c) => <span className="text-admin-ink">{c._count.articles}</span>
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
      cell: (c) => {
        const lock = c._count.products > 0;
        return (
          <RowActions
            onEdit={() => setEditing(c)}
            onDelete={lock ? undefined : () => handleDelete(c.id)}
            deleteConfirm={`Xoá danh mục "${c.name}"? Hành động không thể hoàn tác.`}
            deleteDisabled={lock}
            deleteDisabledReason={`Có ${c._count.products} sản phẩm — xoá sản phẩm trước`}
            more={[
              {
                label: "Mở trang chi tiết",
                icon: <ExternalLink />,
                onSelect: () => {
                  window.location.href = `/admin/categories/${c.id}`;
                }
              }
            ]}
          />
        );
      }
    }
  ];

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/30 px-4 py-3">
          <div className="text-xs text-admin-mute">
            Đang hiển thị: <span className="font-semibold text-admin-ink">{filteredCount}</span>
            {filteredCount !== totalCount ? <span> / {totalCount}</span> : null}
          </div>
          <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
            Tạo danh mục
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Chưa có danh mục nào. Bấm 'Tạo danh mục' để thêm."
        />
      </div>

      {/* CREATE */}
      <FormDialog<CategoryCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo danh mục mới"
        description={
          <span>
            <code className="rounded bg-admin-subtle px-1 py-0.5 text-xs">schemaConfig</code> định
            nghĩa field AI bóc tách cho sản phẩm trong niche này.
          </span>
        }
        size="xl"
        schema={categoryCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo danh mục"
      >
        <CategoryFields />
      </FormDialog>

      {/* EDIT */}
      <FormDialog<CategoryUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Sửa danh mục "${editing.name}"` : "Sửa danh mục"}
        size="xl"
        schema={categoryUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu"
      >
        <CategoryFields editing />
        <Link
          href={editing ? `/admin/categories/${editing.id}` : "#"}
          className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
        >
          <ExternalLink className="size-3" /> Mở trang chi tiết để xem sản phẩm + SEO nâng cao
        </Link>
      </FormDialog>
    </>
  );
}

function CategoryFields({ editing }: { editing?: boolean }): React.ReactElement {
  return (
    <>
      <ControlledTextField<CategoryCreateInput>
        name="name"
        label="Tên hiển thị"
        required
        placeholder="Robot hút bụi lau nhà"
      />
      <ControlledTextField<CategoryCreateInput>
        name="slug"
        label="Slug (kebab-case)"
        required
        mono
        placeholder="robot-hut-bui-lau-nha"
        disabled={editing}
        hint={editing ? "Đổi slug ở trang chi tiết để tránh phá SEO." : undefined}
      />
      {editing ? (
        <ControlledSelectField<CategoryUpdateInput>
          name="status"
          label="Trạng thái"
          options={CATEGORY_STATUS_OPTIONS}
        />
      ) : null}
      {!editing ? (
        <>
          <ControlledTextField<CategoryCreateInput>
            name="seoTitle"
            label="SEO title"
            placeholder="Robot hút bụi lau nhà tốt nhất 2026"
          />
          <ControlledTextareaField<CategoryCreateInput>
            name="seoDescription"
            label="SEO description"
            placeholder="Tổng hợp robot hút bụi lau nhà tốt nhất..."
            rows={2}
            fullRow
          />
        </>
      ) : null}
      <ControlledTextareaField<CategoryCreateInput>
        name="schemaConfig"
        label="schemaConfig (JSON)"
        mono
        rows={6}
        fullRow
        hint='Ví dụ: {"suctionPower": "number", "batteryMinutes": "number"}'
      />
    </>
  );
}

function toFormValues(row: CategoryRow): CategoryUpdateInput {
  // Lưu ý: bỏ qua seoTitle/seoDescription — list endpoint không trả về, nếu set
  // null từ dialog sẽ ghi đè bản DB. Admin sửa SEO ở trang chi tiết qua ⋯.
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    schemaConfig: JSON.stringify(row.schemaConfig ?? {}, null, 2)
  };
}
