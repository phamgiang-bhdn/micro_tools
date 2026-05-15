"use client";

import * as React from "react";
import { Plus, PowerOff, Power, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AdminButton,
  DataTable,
  FormDialog,
  RowActions,
  StatusPill,
  NetworkBadge,
  ControlledTextField,
  ControlledNumberField,
  ControlledSelectField,
  ControlledDateField,
  ControlledTextareaField,
  type ColumnDef
} from "../../../components/admin/ui";
import { NETWORK_OPTIONS } from "../../../lib/admin/constants";
import {
  couponCreateSchema,
  type CouponCreateInput,
  type CouponUpdateInput
} from "../../../lib/admin/schemas";
import {
  createCouponAction,
  updateCouponAction,
  toggleCouponActiveAction,
  deleteCouponAction
} from "../actions";

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: string | null;
  network: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  product: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export interface CategoryLite {
  id: string;
  name: string;
}

interface CouponsTableProps {
  rows: CouponRow[];
  categories: CategoryLite[];
  /** Tổng đếm trước khi paginate (caption). */
  filteredCount: number;
  totalCount: number;
}

const EMPTY_CREATE: CouponCreateInput = {
  code: "",
  description: null,
  discountPercent: null,
  network: null,
  categoryId: null,
  productId: null,
  expiresAt: null,
  isActive: true
};

/**
 * Toàn bộ tương tác của trang coupons. Page.tsx (RSC) chỉ pass data xuống.
 * Mọi action (tạo / sửa / bật-tắt / xoá) gọi server action gốc qua FormData wrapper.
 */
export function CouponsTable({
  rows,
  categories,
  filteredCount,
  totalCount
}: CouponsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CouponRow | null>(null);

  const categoryOptions = React.useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  // Server action wrappers — typed → FormData (giữ server action ko đổi).
  const handleCreate = async (data: CouponCreateInput) => {
    const fd = toCouponFormData(data);
    await createCouponAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleUpdate = async (data: CouponCreateInput) => {
    if (!editing) return { ok: false, error: "Mất context coupon đang sửa" };
    const fd = toCouponFormData(data);
    fd.set("id", editing.id);
    await updateCouponAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteCouponAction(fd);
    router.refresh();
  };

  const handleToggle = async (id: string, nextActive: boolean) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("isActive", String(nextActive));
    await toggleCouponActiveAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<CouponRow>[] = [
    {
      key: "code",
      header: "Mã",
      cell: (c) => (
        <div className="min-w-0">
          <code className="rounded bg-admin-subtle px-2 py-1 font-mono text-xs font-bold text-admin-ink">
            {c.code}
          </code>
          {c.description ? (
            <div className="mt-1 line-clamp-1 text-[11px] text-admin-mute">{c.description}</div>
          ) : null}
        </div>
      )
    },
    {
      key: "discount",
      header: "Giảm",
      cell: (c) => (
        <span className="font-semibold text-admin-ink">
          {c.discountPercent
            ? `${c.discountPercent}%`
            : c.discountAmount
              ? `₫${Number(c.discountAmount).toLocaleString("vi-VN")}`
              : "—"}
        </span>
      )
    },
    {
      key: "scope",
      header: "Phạm vi",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-xs text-admin-mute">
          {c.product ? (
            <>
              Sản phẩm: <span className="text-admin-ink">{c.product.name}</span>
            </>
          ) : c.category ? (
            <>
              Danh mục: <span className="text-admin-ink">{c.category.name}</span>
            </>
          ) : c.network ? (
            <NetworkBadge network={c.network} />
          ) : (
            "Toàn site"
          )}
        </div>
      )
    },
    {
      key: "expires",
      header: "Hết hạn",
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-admin-mute">
          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("vi-VN") : "Không hạn"}
        </span>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (c) =>
        c.isActive ? (
          <StatusPill tone="success" dot>
            Đang chạy
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" dot>
            Tạm tắt
          </StatusPill>
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
          onDelete={() => handleDelete(c.id)}
          deleteConfirm={`Xoá mã "${c.code}"?`}
          more={[
            {
              label: c.isActive ? "Tạm tắt" : "Bật lại",
              icon: c.isActive ? <PowerOff /> : <Power />,
              onSelect: () => handleToggle(c.id, !c.isActive)
            },
            {
              label: "Copy mã",
              icon: <Copy />,
              onSelect: async () => {
                try {
                  await navigator.clipboard.writeText(c.code);
                } catch {
                  /* clipboard có thể bị chặn — bỏ qua, ko block UX */
                }
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
            Đang hiển thị: <span className="font-semibold text-admin-ink">{filteredCount}</span>
            {filteredCount !== totalCount ? <span> / {totalCount}</span> : null}
          </div>
          <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
            Tạo coupon
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Không có mã nào. Bấm 'Tạo coupon' để thêm."
        />
      </div>

      {/* CREATE */}
      <FormDialog<CouponCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo mã giảm giá"
        description="Mã có thể gắn theo network, danh mục, sản phẩm cụ thể — hoặc để trống nếu áp cho toàn site."
        size="lg"
        schema={couponCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo mã"
      >
        <CouponFields categoryOptions={categoryOptions} />
      </FormDialog>

      {/* EDIT */}
      <FormDialog<CouponCreateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Sửa mã "${editing.code}"` : "Sửa coupon"}
        size="lg"
        schema={couponCreateSchema}
        defaultValues={editing ? toFormValues(editing) : EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu"
      >
        <CouponFields categoryOptions={categoryOptions} editing />
      </FormDialog>
    </>
  );
}

function CouponFields({
  categoryOptions,
  editing
}: {
  categoryOptions: Array<{ value: string; label: string }>;
  editing?: boolean;
}): React.ReactElement {
  return (
    <>
      <ControlledTextField<CouponCreateInput>
        name="code"
        label="Mã giảm giá"
        required
        mono
        placeholder="SUMMER2026"
        className="uppercase"
        disabled={editing}
        hint={editing ? "Không sửa được mã (tránh phá tracking)." : undefined}
      />
      <ControlledNumberField<CouponCreateInput>
        name="discountPercent"
        label="% giảm"
        min={1}
        max={100}
        placeholder="20"
      />
      <ControlledSelectField<CouponCreateInput>
        name="network"
        label="Áp cho network"
        options={NETWORK_OPTIONS}
        allowEmpty
        emptyLabel="— Tất cả network —"
        placeholder="— Tất cả network —"
      />
      <ControlledSelectField<CouponCreateInput>
        name="categoryId"
        label="Áp cho danh mục"
        options={categoryOptions}
        allowEmpty
        emptyLabel="— Toàn site —"
        placeholder="— Toàn site —"
      />
      <ControlledDateField<CouponCreateInput>
        name="expiresAt"
        label="Hết hạn"
        placeholder="Không hạn"
      />
      <div />
      <ControlledTextareaField<CouponCreateInput>
        name="description"
        label="Mô tả"
        placeholder="Khuyến mãi hè 2026 — giảm 20% tất cả sản phẩm gia dụng"
        rows={3}
        fullRow
      />
    </>
  );
}

// ===== Helpers =====

function toCouponFormData(data: CouponCreateInput): FormData {
  const fd = new FormData();
  fd.set("code", data.code);
  if (data.description) fd.set("description", data.description);
  if (data.discountPercent != null) fd.set("discountPercent", String(data.discountPercent));
  if (data.network) fd.set("network", data.network);
  if (data.categoryId) fd.set("categoryId", data.categoryId);
  if (data.productId) fd.set("productId", data.productId);
  if (data.expiresAt) fd.set("expiresAt", data.expiresAt);
  fd.set("isActive", data.isActive ? "true" : "false");
  return fd;
}

function toFormValues(row: CouponRow): CouponCreateInput {
  return {
    code: row.code,
    description: row.description,
    discountPercent: row.discountPercent,
    network: (row.network ?? null) as CouponCreateInput["network"],
    categoryId: row.category?.id ?? null,
    productId: row.product?.id ?? null,
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : null,
    isActive: row.isActive
  };
}

// Used by `* as React`
export type { CouponUpdateInput };
