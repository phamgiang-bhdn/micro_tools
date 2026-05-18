"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Eye } from "lucide-react";
import {
  AdminButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  FormDialog,
  RowActions,
  StatusPill,
  ControlledTextField,
  ControlledTextareaField,
  ControlledSelectField,
  type ColumnDef
} from "../../../components/admin/ui";
import { BulkBar, selectionColumnRenderers, buildBulkConfirmMessage, type BulkAction } from "../../../components/admin/bulk-bar";
import { useRowSelection } from "../../../components/admin/use-row-selection";
import { CATEGORY_STATUS_META, CATEGORY_STATUS_OPTIONS } from "../../../lib/admin/constants";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type CategoryCreateInput,
  type CategoryUpdateInput
} from "../../../lib/admin/schemas";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  bulkCategoryAction
} from "../actions";
import { withToast } from "../../../lib/admin/notify";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { products: number; articles: number; campaigns?: number };
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

const BULK_ACTIONS: BulkAction[] = [
  { value: "activate", label: "Bật hiển thị", confirm: "Bật public các danh mục đã chọn?" },
  { value: "deactivate", label: "Ẩn", confirm: "Ẩn các danh mục đã chọn?" },
  {
    value: "delete",
    label: "Xoá",
    confirm: "Xoá danh mục? Không hoàn tác. Sẽ fail nếu còn sản phẩm.",
    tone: "danger"
  }
];

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function CategoriesTable({
  rows,
  filteredCount,
  totalCount
}: CategoriesTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [viewing, setViewing] = React.useState<CategoryRow | null>(null);
  const { selected, toggleOne, toggleAll, clear, allSelected } = useRowSelection(rows);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

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

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    const cfg = BULK_ACTIONS.find((b) => b.value === bulkAction);
    const msg = buildBulkConfirmMessage(cfg, selected.size);
    if (msg && !window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("action", bulkAction);
    for (const id of selected) fd.append("ids", id);
    setBulkPending(true);
    const result = await withToast(() => bulkCategoryAction(fd), {
      loading: `Đang xử lý ${selected.size} danh mục…`,
      success: `Đã ${cfg?.label.toLowerCase() ?? "xử lý"} ${selected.size} danh mục`,
      error: (e) => (e instanceof Error ? e.message : "Thao tác hàng loạt thất bại")
    });
    setBulkPending(false);
    if (result !== null) {
      clear();
      setBulkAction("");
      router.refresh();
    }
  };

  const sel = selectionColumnRenderers<CategoryRow>({
    allSelected,
    toggleAll,
    isSelected: (id) => selected.has(id),
    toggleOne,
    rowLabel: (c) => `danh mục ${c.name}`
  });

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: "select",
      header: sel.header,
      width: "40px",
      cell: sel.cell
    },
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
                label: "Xem chi tiết",
                icon: <Eye />,
                onSelect: () => setViewing(c)
              },
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
        <BulkBar
          selectedCount={selected.size}
          totalCount={rows.length}
          actions={BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={handleBulk}
          pending={bulkPending}
          rightSlot={
            <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
              Tạo danh mục
            </AdminButton>
          }
        />
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

      {/* VIEW DETAIL */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent
          size="xl"
          title={viewing?.name ?? "Danh mục"}
          description={viewing ? <span className="font-mono">{viewing.slug}</span> : undefined}
          footer={
            <DialogFooter>
              <AdminButton variant="ghost" size="sm" onClick={() => setViewing(null)}>
                Đóng
              </AdminButton>
              {viewing ? (
                <AdminButton
                  size="sm"
                  onClick={() => {
                    const target = viewing;
                    setViewing(null);
                    setEditing(target);
                  }}
                >
                  Sửa
                </AdminButton>
              ) : null}
            </DialogFooter>
          }
        >
          {viewing ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={CATEGORY_STATUS_META[viewing.status].tone} dot>
                  {CATEGORY_STATUS_META[viewing.status].label}
                </StatusPill>
                <span className="text-xs text-admin-mute">
                  {viewing._count.products} sản phẩm · {viewing._count.articles} bài viết
                  {typeof viewing._count.campaigns === "number"
                    ? ` · ${viewing._count.campaigns} campaign`
                    : ""}
                </span>
              </div>
              <FieldRow label="SEO title" value={viewing.seoTitle ?? "—"} />
              <FieldRow
                label="SEO description"
                value={viewing.seoDescription ?? "—"}
                multiline
              />
              <div>
                <div className="mb-1 text-xs font-medium text-admin-mute">schemaConfig</div>
                <pre className="max-h-96 overflow-auto rounded-md border border-admin-line bg-admin-subtle/30 p-3 text-[11px] leading-relaxed text-admin-ink">
                  {JSON.stringify(viewing.schemaConfig ?? {}, null, 2)}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] text-admin-mute">
                <div>
                  <div className="font-medium text-admin-ink">Tạo lúc</div>
                  {dateFmt.format(new Date(viewing.createdAt))}
                </div>
                <div>
                  <div className="font-medium text-admin-ink">Cập nhật</div>
                  {dateFmt.format(new Date(viewing.updatedAt))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldRow({
  label,
  value,
  multiline
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): React.ReactElement {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-admin-mute">{label}</div>
      <div className={multiline ? "whitespace-pre-wrap text-admin-ink" : "text-admin-ink"}>
        {value}
      </div>
    </div>
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
