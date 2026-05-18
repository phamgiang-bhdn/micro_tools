"use client";

import * as React from "react";
import { Plus, PowerOff, Power, Copy, CheckCircle2 } from "lucide-react";
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
  deleteCouponAction,
  approveCouponAction,
  archiveCouponAction
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
  niche: { id: string; name: string } | null;
  merchantSlug: string | null;
  merchantDisplay: string | null;
  merchantLogo: string | null;
  iconText: string | null;
  atCouponId: string | null;
  atLastSyncedAt: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
}

export interface NicheLite {
  id: string;
  name: string;
}

interface CouponsTableProps {
  rows: CouponRow[];
  niches: NicheLite[];
  /** Tổng đếm trước khi paginate (caption). */
  filteredCount: number;
  totalCount: number;
}

const EMPTY_CREATE: CouponCreateInput = {
  code: "",
  description: null,
  discountPercent: null,
  network: null,
  nicheId: null,
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
  niches,
  filteredCount,
  totalCount
}: CouponsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CouponRow | null>(null);
  // Form chung cho "Xem chi tiết" + "Sửa".

  const nicheOptions = React.useMemo(
    () => niches.map((c) => ({ value: c.id, label: c.name })),
    [niches]
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

  const handleApprove = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await approveCouponAction(fd);
    router.refresh();
  };

  const handleArchive = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await archiveCouponAction(fd);
    router.refresh();
  };

  const columns: ColumnDef<CouponRow>[] = [
    {
      key: "merchant",
      header: "Cửa hàng",
      hideOnMobile: true,
      cell: (c) =>
        c.merchantSlug ? (
          <div className="flex items-center gap-2 min-w-0">
            {c.merchantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.merchantLogo}
                alt=""
                className="size-6 shrink-0 rounded-full bg-white object-contain ring-1 ring-admin-line"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-admin-ink">
                {c.merchantDisplay ?? c.merchantSlug}
              </p>
              {c.iconText ? (
                <span className="inline-block rounded-full bg-admin-subtle px-1.5 py-0.5 text-[10px] text-admin-mute">
                  {c.iconText}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="text-xs text-admin-mute">—</span>
        )
    },
    {
      key: "code",
      header: "Mã / Mô tả",
      cell: (c) => (
        <div className="min-w-0">
          <code className="rounded bg-admin-subtle px-2 py-1 font-mono text-[11px] font-bold text-admin-ink">
            {c.atCouponId ?? c.code}
          </code>
          {c.description ? (
            <div className="mt-1 line-clamp-2 text-[11px] text-admin-mute">{c.description}</div>
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
          ) : c.niche ? (
            <>
              Niche: <span className="text-admin-ink">{c.niche.name}</span>
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
        ) : c.atCouponId ? (
          <StatusPill tone="warning" dot>
            Chờ duyệt
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
      cell: (c) => {
        const more = [
          ...(c.isActive
            ? [
                {
                  label: "Archive",
                  icon: <PowerOff />,
                  onSelect: () => handleArchive(c.id)
                }
              ]
            : [
                {
                  label: "Approve (publish)",
                  icon: <CheckCircle2 />,
                  onSelect: () => handleApprove(c.id)
                }
              ]),
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
        ];
        return (
          <RowActions
            onView={() => setEditing(c)}
            onEdit={() => setEditing(c)}
            onDelete={() => handleDelete(c.id)}
            deleteConfirm={`Xoá mã "${c.code}"?`}
            more={more}
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
            Tạo mã giảm giá
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
        size="lg"
        schema={couponCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo mã"
      >
        <CouponFields nicheOptions={nicheOptions} />
      </FormDialog>

      {/* EDIT */}
      <FormDialog<CouponCreateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing ? (
            <div className="flex items-center gap-2">
              <span className="font-mono">{editing.code}</span>
              <span className="text-sm font-normal text-admin-mute">
                {editing.merchantDisplay ?? editing.merchantSlug ?? ""}
              </span>
            </div>
          ) : (
            "Chi tiết mã giảm giá"
          )
        }
        size="xl"
        schema={couponCreateSchema}
        defaultValues={editing ? toFormValues(editing) : EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu thay đổi"
      >
        {editing ? <CouponReadonlyInfo row={editing} /> : null}
        <CouponFields nicheOptions={nicheOptions} editing />
      </FormDialog>
    </>
  );
}

function CouponReadonlyInfo({ row }: { row: CouponRow }): React.ReactElement {
  return (
    <div className="sm:col-span-2 -mt-1 mb-1 space-y-2 rounded-lg border border-admin-line bg-admin-subtle/30 p-3 text-xs">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-admin-mute">
        Xem trước
      </div>
      <div className="flex flex-wrap gap-3">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt=""
            className="max-h-32 rounded-md border border-admin-line object-contain"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          {row.contentHtml ? (
            <div
              className="prose prose-sm max-w-none text-[12.5px] text-admin-ink"
              // contentHtml đã được sanitize ở backend
              dangerouslySetInnerHTML={{ __html: row.contentHtml }}
            />
          ) : (
            <p className="text-admin-mute">Mã này không có nội dung mô tả.</p>
          )}
        </div>
      </div>
      {row.atLastSyncedAt ? (
        <p className="text-[10.5px] text-admin-mute">
          Đồng bộ gần nhất: {new Date(row.atLastSyncedAt).toLocaleString("vi-VN")}
        </p>
      ) : null}
    </div>
  );
}

function CouponFields({
  nicheOptions,
  editing
}: {
  nicheOptions: Array<{ value: string; label: string }>;
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
        name="nicheId"
        label="Áp cho niche"
        options={nicheOptions}
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
  if (data.nicheId) fd.set("nicheId", data.nicheId);
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
    nicheId: row.niche?.id ?? null,
    productId: row.product?.id ?? null,
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : null,
    isActive: row.isActive
  };
}

// Used by `* as React`
export type { CouponUpdateInput };
