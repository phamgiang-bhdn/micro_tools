"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ExternalLink, Eye, EyeOff } from "lucide-react";
import {
  AdminButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  FormDialog,
  RowActions,
  StatusPill,
  NetworkBadge,
  ControlledTextField,
  ControlledSelectField,
  ControlledCheckboxField,
  type ColumnDef
} from "../../../components/admin/ui";
import { BulkBar, selectionColumnRenderers, buildBulkConfirmMessage, type BulkAction } from "../../../components/admin/bulk-bar";
import { useRowSelection } from "../../../components/admin/use-row-selection";
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
  toggleProductPublicAction,
  bulkProductAction
} from "../actions";

export interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  network: string;
  isPublic: boolean;
  affiliateUrl: string;
  updatedAt: string;
  createdAt?: string;
  category: { id: string; slug: string; name: string };
  scrapedData?: Record<string, unknown> | null;
  campaign?: { id: string; name: string; atCampaignId: string | null } | null;
  _count?: { clickLogs?: number; extractions?: number };
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

const BULK_ACTIONS: BulkAction[] = [
  { value: "make-public", label: "Đặt public", confirm: "Bật public các sản phẩm đã chọn?" },
  { value: "make-private", label: "Đặt private", confirm: "Ẩn khỏi storefront?" },
  {
    value: "delete",
    label: "Xoá",
    confirm:
      "Xoá vĩnh viễn sản phẩm? Không hoàn tác — sẽ xoá luôn ClickLog/Extraction cascade.",
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

export function ProductsTable({
  rows,
  categories,
  totalCount,
  hasFilter
}: ProductsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  const [viewing, setViewing] = React.useState<ProductRow | null>(null);
  const { selected, toggleOne, toggleAll, clear, allSelected } = useRowSelection(rows);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

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

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    const cfg = BULK_ACTIONS.find((b) => b.value === bulkAction);
    const msg = buildBulkConfirmMessage(cfg, selected.size);
    if (msg && !window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("action", bulkAction);
    for (const id of selected) fd.append("ids", id);
    setBulkPending(true);
    try {
      await bulkProductAction(fd);
      clear();
      setBulkAction("");
      router.refresh();
    } finally {
      setBulkPending(false);
    }
  };

  const sel = selectionColumnRenderers<ProductRow>({
    allSelected,
    toggleAll,
    isSelected: (id) => selected.has(id),
    toggleOne,
    rowLabel: (p) => `sản phẩm ${p.name}`
  });

  const columns: ColumnDef<ProductRow>[] = [
    {
      key: "select",
      header: sel.header,
      width: "40px",
      cell: sel.cell
    },
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
              label: "Xem chi tiết",
              icon: <Eye />,
              onSelect: () => setViewing(p)
            },
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
        <BulkBar
          selectedCount={selected.size}
          totalCount={rows.length}
          actions={BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={handleBulk}
          pending={bulkPending}
          rightSlot={
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-admin-mute">
                Đang hiển thị: <span className="font-semibold text-admin-ink">{rows.length}</span>
                {totalCount !== rows.length ? <span> / {totalCount}</span> : null}
                {hasFilter ? <span className="ml-1 text-admin-mute">(theo lọc)</span> : null}
              </div>
              <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
                Thêm sản phẩm
              </AdminButton>
            </div>
          }
        />
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

      {/* VIEW DETAIL */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent
          size="xl"
          title={viewing?.name ?? "Sản phẩm"}
          description={viewing?.slug ? <span className="font-mono">{viewing.slug}</span> : undefined}
          footer={
            <DialogFooter>
              <AdminButton variant="ghost" size="sm" onClick={() => setViewing(null)}>
                Đóng
              </AdminButton>
              {viewing ? (
                <AdminButton
                  size="sm"
                  onClick={() => {
                    window.location.href = `/admin/products/${viewing.id}`;
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
                {viewing.isPublic ? (
                  <StatusPill tone="success" dot>
                    Đang hiện
                  </StatusPill>
                ) : (
                  <StatusPill tone="neutral" dot>
                    Đang ẩn
                  </StatusPill>
                )}
                <NetworkBadge network={viewing.network} />
                <span className="text-xs text-admin-mute">{viewing.category.name}</span>
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-admin-mute">Affiliate URL</div>
                <div className="flex items-center gap-2">
                  <code className="line-clamp-1 flex-1 rounded bg-admin-subtle px-2 py-1 font-mono text-[11px] text-admin-ink">
                    {viewing.affiliateUrl}
                  </code>
                  <a
                    href={viewing.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:underline"
                  >
                    Mở <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-xs font-medium text-admin-mute">Campaign</div>
                <div className="text-admin-ink">
                  {viewing.campaign ? (
                    <span>
                      {viewing.campaign.name}
                      {viewing.campaign.atCampaignId ? (
                        <span className="ml-2 font-mono text-[11px] text-admin-mute">
                          {viewing.campaign.atCampaignId}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-admin-mute">—</span>
                  )}
                </div>
              </div>
              {viewing._count ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-medium text-admin-mute">ClickLogs</div>
                    <div className="text-admin-ink">{viewing._count.clickLogs ?? 0}</div>
                  </div>
                  <div>
                    <div className="font-medium text-admin-mute">Extractions</div>
                    <div className="text-admin-ink">{viewing._count.extractions ?? 0}</div>
                  </div>
                </div>
              ) : null}
              <div>
                <div className="mb-1 text-xs font-medium text-admin-mute">scrapedData</div>
                <pre className="max-h-96 overflow-auto rounded-md border border-admin-line bg-admin-subtle/30 p-3 text-[11px] leading-relaxed text-admin-ink">
                  {JSON.stringify(viewing.scrapedData ?? {}, null, 2)}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] text-admin-mute">
                {viewing.createdAt ? (
                  <div>
                    <div className="font-medium text-admin-ink">Tạo lúc</div>
                    {dateFmt.format(new Date(viewing.createdAt))}
                  </div>
                ) : null}
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
