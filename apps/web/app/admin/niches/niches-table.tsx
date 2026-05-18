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
import { NICHE_STATUS_META, NICHE_STATUS_OPTIONS } from "../../../lib/admin/constants";
import {
  nicheCreateSchema,
  nicheUpdateSchema,
  type NicheCreateInput,
  type NicheUpdateInput
} from "../../../lib/admin/schemas";
import {
  createNicheAction,
  updateNicheAction,
  deleteNicheAction
} from "../actions";

export interface NicheRow {
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

interface NichesTableProps {
  rows: NicheRow[];
  filteredCount: number;
  totalCount: number;
}

const DEFAULT_SCHEMA_JSON = `{
  "suctionPower": "number",
  "batteryMinutes": "number",
  "noiseLevel": "number"
}`;

const EMPTY_CREATE: NicheCreateInput = {
  name: "",
  slug: "",
  schemaConfig: DEFAULT_SCHEMA_JSON,
  seoTitle: null,
  seoDescription: null
};

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function NichesTable({
  rows,
  filteredCount,
  totalCount
}: NichesTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  // Form chung cho "Xem chi tiết" + "Sửa".
  const [editing, setEditing] = React.useState<NicheRow | null>(null);

  const handleCreate = async (data: NicheCreateInput) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    fd.set("schemaConfig", data.schemaConfig);
    await createNicheAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleUpdate = async (data: NicheUpdateInput) => {
    if (!editing) return { ok: false, error: "Mất context niche đang sửa" };
    const fd = new FormData();
    fd.set("id", editing.id);
    if (data.name) fd.set("name", data.name);
    if (data.slug) fd.set("slug", data.slug);
    if (data.schemaConfig) fd.set("schemaConfig", data.schemaConfig);
    if (data.status) fd.set("status", data.status);
    if (data.seoTitle !== undefined) fd.set("seoTitle", data.seoTitle ?? "");
    if (data.seoDescription !== undefined) fd.set("seoDescription", data.seoDescription ?? "");
    await updateNicheAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteNicheAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<NicheRow>[] = [
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
            onView={() => setEditing(c)}
            onEdit={() => setEditing(c)}
            onDelete={() => handleDelete(c.id)}
            deleteConfirm={`Xoá ngành hàng "${c.name}"? Hành động không thể hoàn tác.`}
            deleteDisabled={lock}
            deleteDisabledReason={`Có ${c._count.products} sản phẩm — xoá sản phẩm trước`}
            more={[
              {
                label: "Mở trang chi tiết",
                icon: <ExternalLink />,
                onSelect: () => {
                  window.location.href = `/admin/niches/${c.id}`;
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/40 px-4 py-2.5">
          <span className="text-xs text-admin-mute">
            Đang hiển thị: <span className="font-semibold text-admin-ink">{filteredCount}</span>
            {filteredCount !== totalCount ? <span> / {totalCount}</span> : null}
          </span>
          <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
            Tạo ngành hàng
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Chưa có niche nào. Bấm 'Tạo niche' để thêm."
        />
      </div>

      {/* CREATE */}
      <FormDialog<NicheCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo ngành hàng mới"
        size="xl"
        schema={nicheCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo ngành hàng"
      >
        <NicheFields />
      </FormDialog>

      {/* EDIT */}
      <FormDialog<NicheUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing ? (
            <div className="flex items-center gap-2">
              <span>{editing.name}</span>
              <StatusPill tone={NICHE_STATUS_META[editing.status].tone} dot>
                {NICHE_STATUS_META[editing.status].label}
              </StatusPill>
            </div>
          ) : (
            "Chi tiết ngành hàng"
          )
        }
        size="xl"
        schema={nicheUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu thay đổi"
      >
        {editing ? (
          <div className="sm:col-span-2 -mt-1 mb-1 rounded-lg border border-admin-line bg-admin-subtle/30 p-3 text-xs">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-admin-mute">
              Thông tin hệ thống
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <FieldRow
                label="Số liệu"
                value={`${editing._count.products} sản phẩm · ${editing._count.articles} bài viết${
                  typeof editing._count.campaigns === "number"
                    ? ` · ${editing._count.campaigns} chiến dịch`
                    : ""
                }`}
              />
              <FieldRow label="Tạo lúc" value={dateFmt.format(new Date(editing.createdAt))} />
              <FieldRow label="Cập nhật" value={dateFmt.format(new Date(editing.updatedAt))} />
            </div>
          </div>
        ) : null}
        <NicheFields editing />
        <Link
          href={editing ? `/admin/niches/${editing.id}` : "#"}
          className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
        >
          <ExternalLink className="size-3" /> Mở trang chi tiết để xem sản phẩm + SEO nâng cao
        </Link>
      </FormDialog>

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

function NicheFields({ editing }: { editing?: boolean }): React.ReactElement {
  return (
    <>
      <ControlledTextField<NicheCreateInput>
        name="name"
        label="Tên hiển thị"
        required
        placeholder="Robot hút bụi lau nhà"
      />
      <ControlledTextField<NicheCreateInput>
        name="slug"
        label="Slug (kebab-case)"
        required
        mono
        placeholder="robot-hut-bui-lau-nha"
        disabled={editing}
        hint={editing ? "Đổi slug ở trang chi tiết để tránh phá SEO." : undefined}
      />
      {editing ? (
        <ControlledSelectField<NicheUpdateInput>
          name="status"
          label="Trạng thái"
          options={NICHE_STATUS_OPTIONS}
        />
      ) : null}
      {!editing ? (
        <>
          <ControlledTextField<NicheCreateInput>
            name="seoTitle"
            label="SEO title"
            placeholder="Robot hút bụi lau nhà tốt nhất 2026"
          />
          <ControlledTextareaField<NicheCreateInput>
            name="seoDescription"
            label="SEO description"
            placeholder="Tổng hợp robot hút bụi lau nhà tốt nhất..."
            rows={2}
            fullRow
          />
          <ControlledTextareaField<NicheCreateInput>
            name="schemaConfig"
            label="Cấu trúc field (JSON)"
            mono
            rows={6}
            fullRow
          />
        </>
      ) : null}
    </>
  );
}

function toFormValues(row: NicheRow): NicheUpdateInput {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    schemaConfig: JSON.stringify(row.schemaConfig ?? {}, null, 2)
  };
}
