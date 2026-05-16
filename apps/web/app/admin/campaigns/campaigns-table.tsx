"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pause, Play, X as XIcon, CheckCircle2 } from "lucide-react";
import {
  AdminButton,
  DataTable,
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
import {
  createCampaignAction,
  updateCampaignAction,
  updateCampaignStatusAction,
  deleteCampaignAction
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
  createdAt: string;
  updatedAt: string;
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

export function CampaignsTable({
  rows,
  filteredCount,
  totalCount
}: CampaignsTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);

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

  const columns: ColumnDef<CampaignRow>[] = [
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="min-w-0">
          <button
            type="button"
            className="text-left font-medium text-admin-ink transition hover:text-admin-accent"
            onClick={() => setEditing(c)}
          >
            {c.name}
          </button>
          <div className="mt-0.5 font-mono text-[11px] text-admin-mute">{c.externalId}</div>
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
        <span className="text-sm text-admin-ink">
          {c.merchantName ?? <span className="text-admin-mute">—</span>}
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
      key: "products",
      header: "Sản phẩm",
      align: "right",
      cell: (c) => <span className="font-semibold text-admin-ink">{c._count.products}</span>
    },
    {
      key: "conversions",
      header: "Conversion",
      align: "right",
      hideOnMobile: true,
      cell: (c) => <span className="text-admin-ink">{c._count.conversions}</span>
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
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
            more={statusMore}
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
            Tạo campaign
          </AdminButton>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Chưa có campaign nào. Crawler sẽ tự tạo khi gặp campaign trong datafeed, hoặc bấm 'Tạo campaign' để thêm tay."
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
    </>
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
        placeholder="2–8% theo category, cookie 1d"
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
