"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pause,
  Play,
  X as XIcon,
  CheckCircle2,
  PlayCircle,
  Eye
} from "lucide-react";
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
  ControlledTextareaField,
  ControlledSelectField,
  ControlledDateField,
  type ColumnDef
} from "../../../components/admin/ui";
import { BulkBar, selectionColumnRenderers, buildBulkConfirmMessage, type BulkAction } from "../../../components/admin/bulk-bar";
import { useRowSelection } from "../../../components/admin/use-row-selection";
import {
  NETWORK_OPTIONS,
  CAMPAIGN_STATUS_META,
  CAMPAIGN_STATUS_OPTIONS,
  type CampaignStatus,
  type AffiliateNetwork
} from "../../../lib/admin/constants";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  type CampaignCreateInput,
  type CampaignUpdateInput
} from "../../../lib/admin/schemas";
import { summarizeFilterRules } from "../../../lib/admin/filter-rules.schema";
import {
  createCampaignAction,
  updateCampaignAction,
  updateCampaignStatusAction,
  deleteCampaignAction,
  runCampaignCrawlerAction,
  bulkCampaignAction
} from "../actions";

export interface CampaignRow {
  id: string;
  network: AffiliateNetwork;
  externalId: string;
  name: string;
  merchantName: string | null;
  status: CampaignStatus;
  appliedAt: string | null;
  approvedAt: string | null;
  commissionNote: string | null;
  notes: string | null;
  filterRules: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  atCampaignId: string | null;
  atCategoryName: string | null;
  atSubCategory: string | null;
  atLogo: string | null;
  atMerchantUrl: string | null;
  atScope: string | null;
  atCookieDurationSec?: number | null;
  atStartTime?: string | null;
  atEndTime?: string | null;
  atLastSyncedAt: string | null;
  _count: { products: number; conversions: number };
}

interface CampaignsTableProps {
  rows: CampaignRow[];
  filteredCount: number;
  totalCount: number;
}

const EMPTY_CREATE: CampaignCreateInput = {
  network: "ACCESSTRADE",
  externalId: "",
  name: "",
  merchantName: null,
  status: "APPLIED",
  commissionNote: null,
  notes: null
};

const BULK_ACTIONS: BulkAction[] = [
  { value: "status:APPROVED", label: "→ APPROVED", confirm: "Đổi status các campaign sang APPROVED?" },
  { value: "status:PAUSED", label: "→ PAUSED", confirm: "Tạm dừng các campaign?" },
  { value: "status:REJECTED", label: "→ REJECTED", confirm: "Đánh dấu REJECTED?" },
  { value: "status:INACTIVE", label: "→ INACTIVE", confirm: "Vô hiệu hoá?" }
];

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function CampaignsTable({
  rows,
  filteredCount,
  totalCount
}: CampaignsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);
  const [viewing, setViewing] = React.useState<CampaignRow | null>(null);
  const { selected, toggleOne, toggleAll, clear, allSelected } = useRowSelection(rows);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  const handleCreate = async (data: CampaignCreateInput) => {
    const fd = new FormData();
    fd.set("network", data.network);
    fd.set("externalId", data.externalId);
    fd.set("name", data.name);
    if (data.merchantName) fd.set("merchantName", data.merchantName);
    fd.set("status", data.status);
    if (data.commissionNote) fd.set("commissionNote", data.commissionNote);
    if (data.notes) fd.set("notes", data.notes);
    await createCampaignAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleUpdate = async (data: CampaignUpdateInput) => {
    if (!editing) return { ok: false, error: "Mất context campaign đang sửa" };
    const fd = new FormData();
    fd.set("id", editing.id);
    if (data.name) fd.set("name", data.name);
    if (data.status) fd.set("status", data.status);
    if (data.merchantName !== undefined) fd.set("merchantName", data.merchantName ?? "");
    if (data.commissionNote !== undefined) fd.set("commissionNote", data.commissionNote ?? "");
    if (data.notes !== undefined) fd.set("notes", data.notes ?? "");
    if (data.appliedAt !== undefined) fd.set("appliedAt", data.appliedAt ?? "");
    if (data.approvedAt !== undefined) fd.set("approvedAt", data.approvedAt ?? "");
    await updateCampaignAction(fd);
    router.refresh();
    return { ok: true };
  };

  const handleDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteCampaignAction(fd);
    router.refresh();
  };

  const handleSetStatus = async (id: string, status: CampaignStatus) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    await updateCampaignStatusAction(fd);
    router.refresh();
  };

  const handleRunCrawler = async (atCampaignId: string | null) => {
    if (!atCampaignId) {
      window.alert("Campaign chưa có atCampaignId — Sync from Accesstrade trước.");
      return;
    }
    await runCampaignCrawlerAction(atCampaignId);
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
      await bulkCampaignAction(fd);
      clear();
      setBulkAction("");
      router.refresh();
    } finally {
      setBulkPending(false);
    }
  };

  const sel = selectionColumnRenderers<CampaignRow>({
    allSelected,
    toggleAll,
    isSelected: (id) => selected.has(id),
    toggleOne,
    rowLabel: (c) => `campaign ${c.name}`
  });

  const columns: ColumnDef<CampaignRow>[] = [
    {
      key: "select",
      header: sel.header,
      width: "40px",
      cell: sel.cell
    },
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          {c.atLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.atLogo}
              alt=""
              className="size-8 shrink-0 rounded-md border border-admin-line bg-white object-contain"
            />
          ) : (
            <div className="size-8 shrink-0 rounded-md border border-dashed border-admin-line" />
          )}
          <div className="min-w-0">
            <button
              type="button"
              className="text-left font-medium text-admin-ink transition hover:text-admin-accent"
              onClick={() => setEditing(c)}
            >
              {c.name}
            </button>
            <div className="mt-0.5 truncate font-mono text-[11px] text-admin-mute">
              {c.atCampaignId ?? c.externalId}
            </div>
          </div>
        </div>
      )
    },
    {
      key: "network",
      header: "Mạng",
      cell: (c) => <NetworkBadge network={c.network} />
    },
    {
      key: "merchant",
      header: "Merchant",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-sm">
          <div className="text-admin-ink">{c.merchantName ?? <span className="text-admin-mute">—</span>}</div>
          {c.atCategoryName ? (
            <div className="text-[11px] text-admin-mute">{c.atCategoryName}</div>
          ) : null}
        </div>
      )
    },
    {
      key: "rules",
      header: "Filter rules",
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-[12px] text-admin-mute">
          {c.filterRules ? summarizeFilterRules(c.filterRules as never) : "—"}
        </span>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (c) => {
        const meta = CAMPAIGN_STATUS_META[c.status];
        return (
          <StatusPill tone={meta.tone} dot>
            {meta.label}
          </StatusPill>
        );
      }
    },
    {
      key: "synced",
      header: "Sync",
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-[11px] text-admin-mute">{relativeTime(c.atLastSyncedAt)}</span>
      )
    },
    {
      key: "products",
      header: "SP",
      align: "right",
      cell: (c) => <span className="font-semibold text-admin-ink">{c._count.products}</span>
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "140px",
      cell: (c) => {
        const lock = c._count.products > 0 || c._count.conversions > 0;
        const statusMore = CAMPAIGN_STATUS_OPTIONS.filter((s) => s.value !== c.status).map((s) => ({
          label: `→ ${s.label}`,
          icon: iconForStatus(s.value as CampaignStatus),
          onSelect: () => handleSetStatus(c.id, s.value as CampaignStatus)
        }));
        return (
          <RowActions
            onEdit={() => setEditing(c)}
            onDelete={lock ? undefined : () => handleDelete(c.id)}
            deleteConfirm={`Xoá campaign "${c.name}"?`}
            deleteDisabled={lock}
            deleteDisabledReason="Có sản phẩm/conversion — chuyển INACTIVE thay vì xoá"
            more={[
              {
                label: "Xem chi tiết",
                icon: <Eye />,
                onSelect: () => setViewing(c)
              },
              {
                label: "Chạy crawler cho campaign này",
                icon: <PlayCircle />,
                disabled: !c.atCampaignId || c.status !== "APPROVED",
                onSelect: () => handleRunCrawler(c.atCampaignId)
              },
              ...statusMore
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-admin-mute">
                Đang hiển thị: <span className="font-semibold text-admin-ink">{filteredCount}</span>
                {filteredCount !== totalCount ? <span> / {totalCount}</span> : null}
              </div>
              <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
                Tạo campaign
              </AdminButton>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Không có campaign nào khớp filter. Bấm 'Sync from Accesstrade' phía trên hoặc đổi filter."
        />
      </div>

      <FormDialog<CampaignCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo campaign affiliate"
        description="Mỗi campaign là 1 merchant trên affiliate network. externalId phải duy nhất trong scope của network."
        size="lg"
        schema={campaignCreateSchema}
        defaultValues={EMPTY_CREATE}
        resetOnOpen
        onSubmit={handleCreate}
        submitLabel="Tạo campaign"
      >
        <CampaignFields />
      </FormDialog>

      <FormDialog<CampaignUpdateInput>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Sửa campaign "${editing.name}"` : "Sửa campaign"}
        size="lg"
        schema={campaignUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu"
      >
        <CampaignFields editing />
      </FormDialog>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent
          size="xl"
          title={
            viewing ? (
              <div className="flex items-center gap-2">
                {viewing.atLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewing.atLogo}
                    alt=""
                    className="size-6 rounded-md border border-admin-line bg-white object-contain"
                  />
                ) : null}
                <span>{viewing.name}</span>
              </div>
            ) : (
              "Campaign"
            )
          }
          description={
            viewing ? (
              <div className="flex items-center gap-2">
                <NetworkBadge network={viewing.network} />
                <StatusPill tone={CAMPAIGN_STATUS_META[viewing.status].tone} dot>
                  {CAMPAIGN_STATUS_META[viewing.status].label}
                </StatusPill>
              </div>
            ) : undefined
          }
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
              <div className="grid grid-cols-2 gap-3 text-xs">
                <KV label="externalId" mono value={viewing.externalId} />
                <KV label="atCampaignId" mono value={viewing.atCampaignId ?? "—"} />
                <KV label="Merchant" value={viewing.merchantName ?? "—"} />
                <KV
                  label="Merchant URL"
                  value={
                    viewing.atMerchantUrl ? (
                      <a
                        href={viewing.atMerchantUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-admin-accent hover:underline"
                      >
                        {viewing.atMerchantUrl}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <KV label="AT category" value={viewing.atCategoryName ?? "—"} />
                <KV label="AT sub-category" value={viewing.atSubCategory ?? "—"} />
                <KV label="Scope" value={viewing.atScope ?? "—"} />
                <KV
                  label="Cookie duration (s)"
                  value={
                    viewing.atCookieDurationSec != null
                      ? String(viewing.atCookieDurationSec)
                      : "—"
                  }
                />
                <KV
                  label="Start"
                  value={viewing.atStartTime ? dateFmt.format(new Date(viewing.atStartTime)) : "—"}
                />
                <KV
                  label="End"
                  value={viewing.atEndTime ? dateFmt.format(new Date(viewing.atEndTime)) : "—"}
                />
                <KV label="Last AT sync" value={relativeTime(viewing.atLastSyncedAt)} />
                <KV
                  label="Products / Conversions"
                  value={`${viewing._count.products} / ${viewing._count.conversions}`}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-admin-mute">Filter rules</div>
                <div className="text-[12.5px] text-admin-ink">
                  {viewing.filterRules
                    ? summarizeFilterRules(viewing.filterRules as never)
                    : "Chưa cấu hình — crawler dùng DEFAULT_FILTER_RULES."}
                </div>
              </div>
              {viewing.commissionNote ? (
                <KV label="Ghi chú hoa hồng" value={viewing.commissionNote} multiline />
              ) : null}
              {viewing.notes ? <KV label="Ghi chú nội bộ" value={viewing.notes} multiline /> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KV({
  label,
  value,
  mono,
  multiline
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  multiline?: boolean;
}): React.ReactElement {
  return (
    <div className={multiline ? "col-span-2" : undefined}>
      <div className="mb-0.5 text-[11px] font-medium text-admin-mute">{label}</div>
      <div
        className={
          (multiline ? "whitespace-pre-wrap " : "truncate ") +
          (mono ? "font-mono text-[11px] " : "") +
          "text-admin-ink"
        }
      >
        {value}
      </div>
    </div>
  );
}

function CampaignFields({ editing }: { editing?: boolean }): React.ReactElement {
  return (
    <>
      <ControlledSelectField<CampaignCreateInput>
        name="network"
        label="Network"
        options={NETWORK_OPTIONS}
        required
        disabled={editing}
      />
      <ControlledTextField<CampaignCreateInput>
        name="externalId"
        label="externalId"
        required
        mono
        placeholder="shopee-cps-vn"
        disabled={editing}
        hint={editing ? "Khoá để giữ tracking ổn định." : "kebab-case, duy nhất trong network."}
      />
      <ControlledTextField<CampaignCreateInput>
        name="name"
        label="Tên hiển thị"
        required
        placeholder="Shopee CPS"
      />
      <ControlledTextField<CampaignCreateInput>
        name="merchantName"
        label="Merchant"
        placeholder="Shopee"
      />
      <ControlledSelectField<CampaignCreateInput>
        name="status"
        label="Trạng thái"
        options={CAMPAIGN_STATUS_OPTIONS}
      />
      <ControlledTextField<CampaignCreateInput>
        name="commissionNote"
        label="Ghi chú hoa hồng"
        placeholder="2–8% theo niche, cookie 1d"
      />
      {editing ? (
        <>
          <ControlledDateField<CampaignUpdateInput> name="appliedAt" label="Đã apply lúc" />
          <ControlledDateField<CampaignUpdateInput> name="approvedAt" label="Đã duyệt lúc" />
        </>
      ) : null}
      <ControlledTextareaField<CampaignCreateInput>
        name="notes"
        label="Ghi chú nội bộ"
        placeholder="Liên hệ partner, ngày approve, các điều kiện đặc biệt..."
        rows={3}
        fullRow
      />
    </>
  );
}

function toFormValues(row: CampaignRow): CampaignUpdateInput {
  return {
    id: row.id,
    network: row.network,
    externalId: row.externalId,
    name: row.name,
    merchantName: row.merchantName,
    status: row.status,
    commissionNote: row.commissionNote,
    notes: row.notes,
    appliedAt: row.appliedAt ? row.appliedAt.slice(0, 10) : null,
    approvedAt: row.approvedAt ? row.approvedAt.slice(0, 10) : null
  };
}

function iconForStatus(s: CampaignStatus): React.ReactNode {
  switch (s) {
    case "APPROVED":
      return <CheckCircle2 />;
    case "PAUSED":
      return <Pause />;
    case "REJECTED":
      return <XIcon />;
    case "INACTIVE":
      return <XIcon />;
    case "APPLIED":
    default:
      return <Play />;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Chưa sync";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}m trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}
