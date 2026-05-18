"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  DataTable,
  FormDialog,
  RowActions,
  StatusPill,
  ControlledTextField,
  type ColumnDef
} from "../../../components/admin/ui";
import { updateCategoryDisplayNameAction } from "../actions";

export interface CategoryRow {
  id: string;
  slug: string;
  rawValue: string;
  displayName: string | null;
  source: string;
  createdAt: string;
  _count: { products: number };
}

const editSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Tên hiển thị ≥ 1 ký tự")
    .max(120, "Tên hiển thị ≤ 120 ký tự")
});
type EditInput = z.infer<typeof editSchema>;

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

interface CategoriesTableProps {
  rows: CategoryRow[];
  totalCount: number;
}

export function CategoriesTable({ rows }: CategoriesTableProps): React.ReactElement {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);

  const handleEdit = async (data: EditInput): Promise<{ ok: true }> => {
    if (!editing) return { ok: true };
    const fd = new FormData();
    fd.set("id", editing.id);
    fd.set("displayName", data.displayName);
    await updateCategoryDisplayNameAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleClear = async (row: CategoryRow): Promise<void> => {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("displayName", "");
    await updateCategoryDisplayNameAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: "displayName",
      header: "Tên hiển thị",
      cell: (c) =>
        c.displayName ? (
          <button
            type="button"
            className="text-left font-medium text-admin-ink transition hover:text-admin-accent"
            onClick={() => setEditing(c)}
          >
            {c.displayName}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-left font-medium text-admin-warning hover:underline"
            onClick={() => setEditing(c)}
          >
            <StatusPill tone="warning" dot>
              Chưa đặt tên
            </StatusPill>
          </button>
        )
    },
    {
      key: "rawValue",
      header: "Raw (AT)",
      cell: (c) => <span className="text-admin-ink-soft">{c.rawValue}</span>
    },
    {
      key: "slug",
      header: "Slug",
      hideOnMobile: true,
      cell: (c) => <span className="font-mono text-[11.5px] text-admin-mute">{c.slug}</span>
    },
    {
      key: "products",
      header: "Sản phẩm",
      align: "right",
      cell: (c) => <span className="font-semibold text-admin-ink">{c._count.products}</span>
    },
    {
      key: "source",
      header: "Nguồn",
      align: "right",
      hideOnMobile: true,
      cell: (c) => <span className="font-mono text-[11.5px] text-admin-mute">{c.source}</span>
    },
    {
      key: "createdAt",
      header: "Tạo",
      align: "right",
      hideOnMobile: true,
      cell: (c) => (
        <span className="font-mono text-[11.5px] text-admin-mute">
          {dateFmt.format(new Date(c.createdAt))}
        </span>
      )
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
      cell: (c) => (
        <RowActions
          onEdit={() => setEditing(c)}
          more={
            c.displayName
              ? [
                  {
                    label: "Xoá tên (về 'chưa đặt')",
                    onSelect: () => handleClear(c),
                    confirm: `Xoá displayName "${c.displayName}"? Storefront sẽ ẩn category này khỏi filter.`
                  }
                ]
              : undefined
          }
        />
      )
    }
  ];

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Chưa có category nào. Chạy crawler để AT bucket được auto-populate."
        />
      </div>

      <FormDialog<EditInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Đặt tên cho category "${editing.rawValue}"` : "Đặt tên category"}
        description={
          editing ? (
            <span>
              Slug: <code className="font-mono">{editing.slug}</code>. Raw từ AT:{" "}
              <span className="font-medium">{editing.rawValue}</span>. Storefront sẽ dùng
              displayName này khi hiển thị filter.
            </span>
          ) : undefined
        }
        size="lg"
        schema={editSchema}
        defaultValues={{ displayName: editing?.displayName ?? "" }}
        resetOnOpen
        onSubmit={handleEdit}
        submitLabel="Lưu"
      >
        <ControlledTextField<EditInput>
          name="displayName"
          label="Tên hiển thị (cho user)"
          placeholder={editing?.rawValue ?? ""}
          required
          fullRow
        />
      </FormDialog>
    </>
  );
}
