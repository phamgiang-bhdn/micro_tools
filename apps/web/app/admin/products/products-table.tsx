"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ExternalLink, Eye, EyeOff, ImageOff } from "lucide-react";
import { formatMoney } from "../../../lib/format";
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
  toggleProductPublicAction,
  bulkProductAction,
  bulkAssignShopAction
} from "../actions";
import {
  BulkBar,
  selectionColumnRenderers,
  buildBulkConfirmMessage,
  type BulkAction
} from "../../../components/admin/bulk-bar";
import { useBulkSelection } from "../../../components/admin/use-bulk-selection";

export interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  network: string;
  isPublic: boolean;
  affiliateUrl: string;
  updatedAt: string;
  createdAt?: string;
  niche: { id: string; slug: string; name: string } | null;
  scrapedData?: Record<string, unknown> | null;
  campaign?: { id: string; name: string; atCampaignId: string | null } | null;
  shop?: { id: string; slug: string; name: string; logoUrl: string | null } | null;
  _count?: { clickLogs?: number; extractions?: number };
}

export interface NicheLite {
  id: string;
  slug: string;
  name: string;
}

export interface ShopLite {
  id: string;
  slug: string;
  name: string;
  _count: { products: number };
}

interface ProductsTableProps {
  rows: ProductRow[];
  niches: NicheLite[];
  shops: ShopLite[];
  totalCount: number;
  hasFilter: boolean;
}

const PRODUCT_BULK_ACTIONS: BulkAction[] = [
  { value: "make-public", label: "Hiện trên storefront", confirm: "" },
  { value: "make-private", label: "Ẩn khỏi storefront", confirm: "" },
  { value: "assign-niche", label: "Gán ngành hàng…", confirm: "" },
  {
    value: "clear-niche",
    label: "Bỏ gán ngành hàng",
    confirm: "Bỏ ngành hàng của các sản phẩm đã chọn?"
  },
  { value: "assign-shop", label: "Gán shop…", confirm: "" },
  {
    value: "clear-shop",
    label: "Bỏ gán shop",
    confirm: "Bỏ shop của các sản phẩm đã chọn?"
  },
  {
    value: "delete",
    label: "Xoá sản phẩm",
    confirm: "Xoá sản phẩm đã chọn? Hành động không thể hoàn tác.",
    tone: "danger"
  }
];

const EMPTY_CREATE: ProductCreateInput = {
  name: "",
  affiliateUrl: "",
  nicheId: "",
  network: "ACCESSTRADE",
  isPublic: false,
  scrapedData: undefined
};

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const relFmt = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return relFmt.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return relFmt.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return relFmt.format(-diffDay, "day");
  const diffMon = Math.round(diffDay / 30);
  return relFmt.format(-diffMon, "month");
}

interface ScrapedView {
  image?: string;
  price?: number;
  originalPrice?: number;
  discountPercent?: number;
  store?: string;
  brand?: string;
}

function readScraped(raw: Record<string, unknown> | null | undefined): ScrapedView {
  if (!raw) return {};
  const pickString = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  const pickNumber = (keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  return {
    image: pickString(["image", "imageUrl", "thumbnail", "photo"]),
    price: pickNumber(["price", "salePrice", "currentPrice"]),
    originalPrice: pickNumber(["originalPrice", "listPrice", "msrp"]),
    discountPercent: pickNumber(["discountPercent", "discount_rate", "discount"]),
    store: pickString(["store", "merchant", "shop"]),
    brand: pickString(["brand", "manufacturer"])
  };
}

export function ProductsTable({
  rows,
  niches,
  shops,
  totalCount,
  hasFilter
}: ProductsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  // Form chung cho "Xem chi tiết" + "Sửa".

  // ---- Bulk selection ----
  const visibleIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useBulkSelection(visibleIds);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkNicheId, setBulkNicheId] = React.useState<string>("");
  const [bulkShopId, setBulkShopId] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  // Reset extra-slot state khi đổi action chính.
  React.useEffect(() => {
    setBulkNicheId("");
    setBulkShopId("");
  }, [bulkAction]);

  const selectColumn = React.useMemo<ColumnDef<ProductRow>>(() => {
    const r = selectionColumnRenderers<ProductRow>({
      allSelected: selection.allSelected,
      toggleAll: selection.toggleAll,
      isSelected: selection.isSelected,
      toggleOne: selection.toggleOne,
      rowLabel: (row) => row.name
    });
    return {
      key: "_select",
      header: r.header,
      cell: r.cell,
      width: "44px",
      noTruncate: true
    };
  }, [selection.allSelected, selection.toggleAll, selection.isSelected, selection.toggleOne]);

  const applyBulk = async (): Promise<void> => {
    if (!bulkAction || selection.count === 0) return;
    const cfg = PRODUCT_BULK_ACTIONS.find((a) => a.value === bulkAction);
    if (bulkAction === "assign-niche" && !bulkNicheId) {
      alert("Chọn ngành hàng trước khi áp dụng.");
      return;
    }
    if (bulkAction === "assign-shop" && !bulkShopId) {
      alert("Chọn shop trước khi áp dụng.");
      return;
    }
    const confirmMsg = buildBulkConfirmMessage(cfg, selection.count);
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setBulkPending(true);
    try {
      const fd = new FormData();
      for (const id of selection.selected) fd.append("ids", id);
      if (bulkAction === "assign-shop") {
        fd.set("shopId", bulkShopId);
        await bulkAssignShopAction(fd);
      } else if (bulkAction === "clear-shop") {
        fd.set("shopId", "");
        await bulkAssignShopAction(fd);
      } else {
        fd.set("action", bulkAction);
        if (bulkAction === "assign-niche") fd.set("nicheId", bulkNicheId);
        await bulkProductAction(fd);
      }
      selection.clear();
      setBulkAction("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk action thất bại");
    } finally {
      setBulkPending(false);
    }
  };

  const nicheOptions = React.useMemo(
    () => niches.map((c) => ({ value: c.id, label: c.name })),
    [niches]
  );

  const shopOptions = React.useMemo(
    () => shops.map((s) => ({ value: s.id, label: s.name })),
    [shops]
  );

  const handleCreate = async (data: ProductCreateInput) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("affiliateUrl", data.affiliateUrl);
    fd.set("nicheId", data.nicheId);
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
    if (data.nicheId) fd.set("nicheId", data.nicheId);
    if (data.network) fd.set("network", data.network);
    if (data.isPublic !== undefined) fd.set("isPublic", data.isPublic ? "true" : "false");
    if (data.shopId !== undefined) fd.set("shopId", data.shopId ?? "");
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
    selectColumn,
    {
      key: "image",
      header: <span className="sr-only">Ảnh</span>,
      width: "56px",
      cell: (p) => {
        const s = readScraped(p.scrapedData);
        return s.image ? (
          <img
            src={s.image}
            alt=""
            loading="lazy"
            className="size-10 rounded-md border border-admin-line object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-admin-line bg-admin-subtle/30 text-admin-mute">
            <ImageOff className="size-3.5" />
          </div>
        );
      }
    },
    {
      key: "name",
      header: "Sản phẩm",
      width: "360px",
      cell: (p) => {
        const s = readScraped(p.scrapedData);
        return (
          <div className="w-[340px] max-w-full">
            <button
              type="button"
              onClick={() => setEditing(p)}
              className="block w-full truncate text-left text-[13px] font-medium text-admin-ink transition hover:text-admin-accent"
              title={p.name}
            >
              {p.name}
            </button>
            {s.brand || s.store ? (
              <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-admin-mute">
                {s.brand ? (
                  <span className="truncate font-medium text-admin-ink/80">{s.brand}</span>
                ) : null}
                {s.store ? <span className="truncate">· {s.store}</span> : null}
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      key: "price",
      header: "Giá",
      align: "right",
      hideOnMobile: true,
      cell: (p) => {
        const s = readScraped(p.scrapedData);
        if (s.price === undefined) return <span className="text-admin-mute">—</span>;
        return (
          <div className="text-right leading-tight">
            <div className="text-[13px] font-semibold text-admin-ink">
              {formatMoney(s.price, "VND")}
            </div>
            {s.originalPrice && s.originalPrice > s.price ? (
              <div className="text-[11px] text-admin-mute line-through">
                {formatMoney(s.originalPrice, "VND")}
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      hideOnMobile: true,
      cell: (p) => {
        const s = readScraped(p.scrapedData);
        if (!s.discountPercent || s.discountPercent <= 0) {
          return <span className="text-admin-mute">—</span>;
        }
        const tone =
          s.discountPercent >= 50 ? "text-rose-600" : s.discountPercent >= 20 ? "text-emerald-600" : "text-admin-ink";
        return <span className={`font-mono text-[13px] font-semibold ${tone}`}>-{s.discountPercent}%</span>;
      }
    },
    {
      key: "niche",
      header: "Ngành hàng",
      hideOnMobile: true,
      cell: (p) =>
        p.niche ? (
          <span className="text-[12.5px] text-admin-ink">{p.niche.name}</span>
        ) : (
          <StatusPill tone="warning" dot>
            Chưa gán
          </StatusPill>
        )
    },
    {
      key: "shop",
      header: "Shop",
      hideOnMobile: true,
      cell: (p) =>
        p.shop ? (
          <div className="flex items-center gap-1.5 leading-tight">
            {p.shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.shop.logoUrl}
                alt={p.shop.name}
                className="size-5 shrink-0 rounded border border-admin-line object-cover"
              />
            ) : null}
            <span className="text-[12.5px] text-admin-ink truncate">{p.shop.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-admin-mute">—</span>
        )
    },
    {
      key: "network",
      header: "Mạng",
      hideOnMobile: true,
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
      key: "updated",
      header: "Cập nhật",
      align: "right",
      hideOnMobile: true,
      cell: (p) => (
        <span className="font-mono text-[11.5px] text-admin-mute" title={dateFmt.format(new Date(p.updatedAt))}>
          {relativeTime(p.updatedAt)}
        </span>
      )
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
      cell: (p) => (
        <RowActions
          onView={() => setEditing(p)}
          onEdit={() => setEditing(p)}
          onDelete={() => handleDelete(p.id)}
          deleteConfirm={`Xoá sản phẩm "${p.name}"? Hành động không thể hoàn tác.`}
          more={[
            {
              label: p.isPublic ? "Ẩn khỏi gian hàng" : "Hiện trên gian hàng",
              icon: p.isPublic ? <EyeOff /> : <Eye />,
              onSelect: () => handleTogglePublic(p.id, !p.isPublic)
            },
            {
              label: "Xem trên gian hàng",
              icon: <ExternalLink />,
              disabled: !p.isPublic || !p.slug || !p.niche,
              onSelect: () => {
                if (!p.isPublic || !p.slug || !p.niche) return;
                window.open(
                  `/categories/${p.niche.slug}/${p.slug}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
            },
            {
              label: "Mở trang chi tiết",
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
          selectedCount={selection.count}
          totalCount={rows.length}
          actions={PRODUCT_BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={applyBulk}
          pending={bulkPending}
          extraSlot={
            bulkAction === "assign-niche" ? (
              <select
                value={bulkNicheId}
                onChange={(e) => setBulkNicheId(e.target.value)}
                className="h-8 rounded-md border border-admin-line bg-admin-surface px-2 pr-7 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
              >
                <option value="">— Chọn ngành hàng —</option>
                {nicheOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : bulkAction === "assign-shop" ? (
              <select
                value={bulkShopId}
                onChange={(e) => setBulkShopId(e.target.value)}
                className="h-8 rounded-md border border-admin-line bg-admin-surface px-2 pr-7 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
              >
                <option value="">— Chọn shop —</option>
                {shopOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : null
          }
          rightSlot={
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-admin-mute">
                Hiển thị <span className="font-semibold text-admin-ink">{rows.length}</span>
                {totalCount !== rows.length ? <span> / {totalCount}</span> : null}
                {hasFilter ? <span className="ml-1 text-admin-mute">(theo lọc)</span> : null}
              </span>
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
          isRowHighlighted={(p) => selection.isSelected(p.id)}
        />
      </div>

      <FormDialog<ProductCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Thêm sản phẩm thủ công"
        size="lg"
        schema={productCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo sản phẩm"
      >
        <ProductFields nicheOptions={nicheOptions} shopOptions={shopOptions} />
      </FormDialog>

      <FormDialog<ProductUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing ? (
            <div className="flex items-center gap-2">
              <span className="truncate">{editing.name}</span>
              {editing.isPublic ? (
                <StatusPill tone="success" dot>
                  Đang hiện
                </StatusPill>
              ) : (
                <StatusPill tone="neutral" dot>
                  Đang ẩn
                </StatusPill>
              )}
              <NetworkBadge network={editing.network} />
            </div>
          ) : (
            "Chi tiết sản phẩm"
          )
        }
        size="xl"
        schema={productUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu thay đổi"
      >
        {editing ? <ProductReadonlyInfo row={editing} /> : null}
        <ProductFields nicheOptions={nicheOptions} shopOptions={shopOptions} editing />
        <Link
          href={editing ? `/admin/products/${editing.id}` : "#"}
          className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
        >
          <ExternalLink className="size-3" /> Mở trang chi tiết để sửa giá, ảnh, thông số…
        </Link>
      </FormDialog>

    </>
  );
}

function ProductFields({
  nicheOptions,
  shopOptions,
  editing
}: {
  nicheOptions: Array<{ value: string; label: string }>;
  shopOptions: Array<{ value: string; label: string }>;
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
        name="nicheId"
        label="Ngành hàng"
        options={nicheOptions}
        required
      />
      <ControlledSelectField<ProductCreateInput>
        name="network"
        label="Mạng affiliate"
        options={NETWORK_OPTIONS}
        required
      />
      {editing ? (
        <ControlledSelectField<ProductUpdateInput>
          name="shopId"
          label="Shop"
          options={shopOptions}
          allowEmpty
          emptyLabel="— Không gán —"
          hint="Hiển thị tên shop trên storefront thay cho campaign."
        />
      ) : null}
      <ControlledCheckboxField<ProductCreateInput>
        name="isPublic"
        label="Hiển thị trên storefront ngay"
        hint="Tắt nếu chưa có đủ thông tin (giá, ảnh…). Vẫn đổi được sau ở dropdown ⋯."
        fullRow
      />
    </>
  );
}

function ProductReadonlyInfo({ row }: { row: ProductRow }): React.ReactElement {
  return (
    <div className="sm:col-span-2 -mt-1 mb-1 space-y-3 rounded-lg border border-admin-line bg-admin-subtle/30 p-3 text-xs">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-admin-mute">
          Thông tin chung
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          <div>
            <div className="text-[10.5px] text-admin-mute">Ngành hàng</div>
            <div className="text-admin-ink">{row.niche?.name ?? "Chưa gán"}</div>
          </div>
          <div>
            <div className="text-[10.5px] text-admin-mute">Cập nhật</div>
            <div className="text-admin-ink">{dateFmt.format(new Date(row.updatedAt))}</div>
          </div>
          {row._count ? (
            <div>
              <div className="text-[10.5px] text-admin-mute">Click / Trích xuất</div>
              <div className="text-admin-ink">
                {row._count.clickLogs ?? 0} / {row._count.extractions ?? 0}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10.5px] text-admin-mute">URL affiliate</div>
        <div className="flex items-center gap-2">
          <code className="line-clamp-1 flex-1 rounded bg-admin-subtle px-2 py-1 font-mono text-[11px] text-admin-ink">
            {row.affiliateUrl}
          </code>
          <a
            href={row.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-admin-accent hover:underline"
          >
            Mở <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function toFormValues(row: ProductRow): ProductUpdateInput {
  return {
    id: row.id,
    name: row.name,
    affiliateUrl: row.affiliateUrl,
    nicheId: row.niche?.id ?? "",
    network: row.network as AffiliateNetwork,
    isPublic: row.isPublic,
    shopId: row.shop?.id ?? ""
  };
}
