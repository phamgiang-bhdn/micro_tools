"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, PlayCircle } from "lucide-react";
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
import {
  NETWORK_OPTIONS,
  CAMPAIGN_STATUS_META,
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
  deleteCampaignAction,
  runSelectedCampaignsCrawlerAction,
  updateCampaignFilterRulesAction,
  getCrawlerProgressAction,
  bulkCampaignAction,
  type RunSelectedCrawlerResult,
  type CrawlerProgress
} from "../actions";
import {
  BulkBar,
  selectionColumnRenderers,
  buildBulkConfirmMessage,
  type BulkAction
} from "../../../components/admin/bulk-bar";
import { useBulkSelection } from "../../../components/admin/use-bulk-selection";
import { withToast } from "../../../lib/admin/notify";
import {
  type FilterRules,
  filterRulesSchema as clientFilterRulesSchema
} from "../../../lib/admin/filter-rules.schema";
import { Sliders } from "lucide-react";

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

const CAMPAIGN_BULK_ACTIONS: BulkAction[] = [
  { value: "status:APPROVED", label: "Chuyển → APPROVED", confirm: "" },
  { value: "status:PAUSED", label: "Chuyển → PAUSED", confirm: "" },
  { value: "status:REJECTED", label: "Chuyển → REJECTED", confirm: "" },
  { value: "status:INACTIVE", label: "Ẩn (INACTIVE)", confirm: "" },
  { value: "crawl", label: "Lấy sản phẩm…", confirm: "" }
];

const EMPTY_CREATE: CampaignCreateInput = {
  network: "ACCESSTRADE",
  externalId: "",
  name: "",
  merchantName: null,
  status: "APPLIED",
  commissionNote: null,
  notes: null
};

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
  // Một dialog dùng chung cho "Xem chi tiết" + "Sửa" — cùng form, hiện đầy đủ data.
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);

  // ---- Bulk selection ----
  const visibleIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useBulkSelection(visibleIds);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  const selectColumn = React.useMemo<ColumnDef<CampaignRow>>(() => {
    const r = selectionColumnRenderers<CampaignRow>({
      allSelected: selection.allSelected,
      toggleAll: selection.toggleAll,
      isSelected: selection.isSelected,
      toggleOne: selection.toggleOne,
      rowLabel: (row) => row.name
    });
    return { key: "_select", header: r.header, cell: r.cell, width: "44px", noTruncate: true };
  }, [selection.allSelected, selection.toggleAll, selection.isSelected, selection.toggleOne]);

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

  const [crawlDialogRows, setCrawlDialogRows] = React.useState<CampaignRow[] | null>(null);
  const [crawlPending, setCrawlPending] = React.useState(false);
  const [crawlLimit, setCrawlLimit] = React.useState<number>(100);
  const [crawlResult, setCrawlResult] = React.useState<RunSelectedCrawlerResult | null>(null);
  const [crawlProgress, setCrawlProgress] = React.useState<CrawlerProgress | null>(null);

  const [filterRulesCampaign, setFilterRulesCampaign] = React.useState<CampaignRow | null>(null);
  const [filterRulesDraft, setFilterRulesDraft] = React.useState<FilterRulesFormState>(EMPTY_FILTER_RULES_FORM);
  const [filterRulesPending, setFilterRulesPending] = React.useState(false);
  const [filterRulesError, setFilterRulesError] = React.useState<string | null>(null);

  const openFilterRulesDialog = (c: CampaignRow) => {
    setFilterRulesDraft(toFilterRulesFormState(c.filterRules));
    setFilterRulesError(null);
    setFilterRulesCampaign(c);
  };

  const handleSaveFilterRules = async () => {
    if (!filterRulesCampaign) return;
    const parsed = parseFilterRulesForm(filterRulesDraft);
    if (!parsed.ok) {
      setFilterRulesError(parsed.error);
      return;
    }
    setFilterRulesError(null);
    setFilterRulesPending(true);
    const result = await withToast(
      () =>
        updateCampaignFilterRulesAction({
          id: filterRulesCampaign.id,
          filterRules: parsed.value
        }),
      {
        loading: "Đang lưu filter rules…",
        success: "Đã lưu filter rules",
        error: (e) => (e instanceof Error ? e.message : "Lưu filter rules thất bại")
      }
    );
    setFilterRulesPending(false);
    if (result !== null) {
      setFilterRulesCampaign(null);
      router.refresh();
    }
  };

  const openCrawlDialog = (campaigns: CampaignRow[]) => {
    const eligible = campaigns.filter((c) => c.atCampaignId && c.merchantName);
    const skipped = campaigns.length - eligible.length;
    if (eligible.length === 0) {
      window.alert(
        skipped > 0
          ? `${skipped} chiến dịch chưa đủ điều kiện — cần đồng bộ từ Accesstrade trước (thiếu ID Accesstrade hoặc tên cửa hàng).`
          : "Chưa chọn chiến dịch nào."
      );
      return;
    }
    setCrawlLimit(100);
    setCrawlResult(null);
    setCrawlDialogRows(eligible);
  };

  const applyBulk = async (): Promise<void> => {
    if (!bulkAction || selection.count === 0) return;
    const selectedRows = rows.filter((r) => selection.isSelected(r.id));
    if (bulkAction === "crawl") {
      openCrawlDialog(selectedRows);
      return;
    }
    const cfg = CAMPAIGN_BULK_ACTIONS.find((a) => a.value === bulkAction);
    const confirmMsg = buildBulkConfirmMessage(cfg, selection.count);
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBulkPending(true);
    try {
      const fd = new FormData();
      for (const id of selection.selected) fd.append("ids", id);
      fd.set("action", bulkAction);
      await bulkCampaignAction(fd);
      selection.clear();
      setBulkAction("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk action thất bại");
    } finally {
      setBulkPending(false);
    }
  };

  const handleConfirmCrawl = async () => {
    if (!crawlDialogRows || crawlDialogRows.length === 0) return;
    setCrawlPending(true);
    setCrawlProgress({
      isRunning: true,
      total: crawlDialogRows.length,
      done: 0,
      currentLabel: "Đang khởi tạo…",
      startedAt: Date.now(),
      finishedAt: null,
      lastError: null
    });

    let cancelled = false;
    const poll = async (): Promise<void> => {
      while (!cancelled) {
        try {
          const p = await getCrawlerProgressAction();
          if (!cancelled) setCrawlProgress(p);
          if (!p.isRunning) break;
        } catch {
          // ignore transient errors — tiếp tục poll
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    };
    const pollPromise = poll();

    const result = await withToast(
      () =>
        runSelectedCampaignsCrawlerAction({
          campaignIds: crawlDialogRows.map((c) => c.id),
          overrideLimit: crawlLimit
        }),
      {
        loading: `Đang lấy sản phẩm — ${crawlDialogRows.length} campaign (limit ${crawlLimit})…`,
        success: (raw) => {
          const r = raw as RunSelectedCrawlerResult;
          return `Xong: +${r.created} mới, ~${r.updated} update, fetched ${r.fetched}`;
        },
        error: (e) => (e instanceof Error ? e.message : "Lấy sản phẩm thất bại")
      }
    );
    cancelled = true;
    await pollPromise;
    setCrawlPending(false);
    if (result) {
      setCrawlResult(result);
      router.refresh();
    }
  };

  const columns: ColumnDef<CampaignRow>[] = [
    selectColumn,
    {
      key: "name",
      header: "Chiến dịch",
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
      header: "Cửa hàng",
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
      header: "Bộ lọc",
      hideOnMobile: true,
      cell: (c) => (
        <button
          type="button"
          onClick={() => openFilterRulesDialog(c)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-admin-mute transition hover:bg-admin-subtle hover:text-admin-accent"
          title="Sửa filter rules"
        >
          <Sliders className="size-3" />
          {c.filterRules ? summarizeFilterRules(c.filterRules as never) : "Default"}
        </button>
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
      header: "Đồng bộ",
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
        return (
          <RowActions
            onView={() => setEditing(c)}
            onEdit={() => setEditing(c)}
            onDelete={() => handleDelete(c.id)}
            deleteConfirm={`Xoá chiến dịch "${c.name}"?`}
            deleteDisabled={lock}
            deleteDisabledReason="Có sản phẩm/đơn hàng — không xoá được"
            more={[
              {
                label: "Lấy sản phẩm…",
                icon: <PlayCircle />,
                disabled: !c.atCampaignId || !c.merchantName,
                onSelect: () => openCrawlDialog([c])
              },
              {
                label: "Bộ lọc lấy sản phẩm…",
                icon: <Sliders />,
                onSelect: () => openFilterRulesDialog(c)
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
          selectedCount={selection.count}
          totalCount={rows.length}
          actions={CAMPAIGN_BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={applyBulk}
          pending={bulkPending}
          rightSlot={
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-admin-mute">
                Hiển thị <span className="font-semibold text-admin-ink">{filteredCount}</span>
                {filteredCount !== totalCount ? <span> / {totalCount}</span> : null}
              </span>
              <AdminButton size="sm" iconLeft={<Plus />} onClick={() => setCreateOpen(true)}>
                Tạo chiến dịch
              </AdminButton>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          emptyState="Không có chiến dịch nào khớp bộ lọc. Bấm 'Đồng bộ từ Accesstrade' phía trên hoặc đổi bộ lọc."
          isRowHighlighted={(c) => selection.isSelected(c.id)}
        />
      </div>

      <FormDialog<CampaignCreateInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo chiến dịch affiliate"
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
        title={
          editing ? (
            <div className="flex items-center gap-2">
              {editing.atLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editing.atLogo}
                  alt=""
                  className="size-6 rounded-md border border-admin-line bg-white object-contain"
                />
              ) : null}
              <span>{editing.name}</span>
              <StatusPill tone={CAMPAIGN_STATUS_META[editing.status].tone} dot>
                {CAMPAIGN_STATUS_META[editing.status].label}
              </StatusPill>
              <NetworkBadge network={editing.network} />
            </div>
          ) : (
            "Chi tiết chiến dịch"
          )
        }
        size="xl"
        schema={campaignUpdateSchema}
        defaultValues={editing ? toFormValues(editing) : { id: "", ...EMPTY_CREATE }}
        resetOnOpen
        onSubmit={handleUpdate}
        submitLabel="Lưu thay đổi"
      >
        {editing ? <CampaignReadonlyInfo row={editing} /> : null}
        <CampaignFields editing />
      </FormDialog>

      {/* FILTER RULES DIALOG */}
      <Dialog
        open={filterRulesCampaign !== null}
        onOpenChange={(o) => {
          if (!o && !filterRulesPending) setFilterRulesCampaign(null);
        }}
      >
        <DialogContent
          size="xl"
          title={
            filterRulesCampaign
              ? `Bộ lọc: ${filterRulesCampaign.name}`
              : "Bộ lọc"
          }
          footer={
            <DialogFooter>
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={filterRulesPending}
                onClick={() => setFilterRulesCampaign(null)}
              >
                Huỷ
              </AdminButton>
              <AdminButton
                variant="secondary"
                size="sm"
                disabled={filterRulesPending}
                onClick={() => setFilterRulesDraft(EMPTY_FILTER_RULES_FORM)}
              >
                Xoá hết (về Default)
              </AdminButton>
              <AdminButton size="sm" loading={filterRulesPending} onClick={handleSaveFilterRules}>
                Lưu
              </AdminButton>
            </DialogFooter>
          }
        >
          {filterRulesCampaign ? (
            <FilterRulesForm
              value={filterRulesDraft}
              onChange={setFilterRulesDraft}
              error={filterRulesError}
              disabled={filterRulesPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* CRAWL CONFIG DIALOG */}
      <Dialog
        open={crawlDialogRows !== null}
        onOpenChange={(o) => {
          if (!o && !crawlPending) {
            setCrawlDialogRows(null);
            setCrawlResult(null);
          }
        }}
      >
        <DialogContent
          size="lg"
          title={
            crawlResult
              ? "Kết quả lấy sản phẩm"
              : crawlPending
                ? "Đang lấy sản phẩm…"
                : crawlDialogRows && crawlDialogRows.length === 1
                  ? `Lấy sản phẩm: ${crawlDialogRows[0].name}`
                  : `Lấy sản phẩm — ${crawlDialogRows?.length ?? 0} chiến dịch`
          }
          footer={
            <DialogFooter>
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={crawlPending}
                onClick={() => {
                  setCrawlDialogRows(null);
                  setCrawlResult(null);
                }}
              >
                {crawlResult ? "Đóng" : "Huỷ"}
              </AdminButton>
              {!crawlResult && crawlDialogRows ? (
                <AdminButton
                  size="sm"
                  iconLeft={<PlayCircle />}
                  loading={crawlPending}
                  onClick={handleConfirmCrawl}
                >
                  {crawlPending ? "Đang lấy…" : "Lấy sản phẩm"}
                </AdminButton>
              ) : null}
            </DialogFooter>
          }
        >
          {crawlPending && crawlProgress ? (
            <CrawlProgressView progress={crawlProgress} />
          ) : crawlDialogRows ? (
            crawlResult ? (
              <CrawlResultView result={crawlResult} />
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <label className="mb-1 block text-xs font-medium text-admin-mute">
                    Số sản phẩm tối đa / chiến dịch (1–500)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={crawlLimit}
                      disabled={crawlPending}
                      onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(v)) setCrawlLimit(Math.min(500, Math.max(1, v)));
                      }}
                      className="h-9 w-28 rounded-md border border-admin-line bg-admin-surface px-2 text-sm text-admin-ink"
                    />
                    <div className="flex gap-1">
                      {[50, 100, 200, 500].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={crawlPending}
                          onClick={() => setCrawlLimit(n)}
                          className={
                            "rounded-md border px-2 py-1 text-[11px] transition " +
                            (crawlLimit === n
                              ? "border-admin-accent bg-admin-accent-soft text-admin-accent-ink"
                              : "border-admin-line text-admin-mute hover:border-admin-accent")
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-admin-mute">
                    Mặc định khi chạy nền là 100. Số càng lớn → Accesstrade trả càng chậm và tốn quota.
                    Bộ lọc của từng chiến dịch vẫn được áp dụng — vào “Bộ lọc lấy sản phẩm” để chỉnh.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-admin-mute">
                    {crawlDialogRows.length} chiến dịch sẽ chạy
                  </p>
                  <div className="max-h-56 overflow-auto rounded-md border border-admin-line">
                    <ul className="divide-y divide-admin-line">
                      {crawlDialogRows.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-admin-ink">{c.name}</div>
                            <div className="truncate font-mono text-[10.5px] text-admin-mute">
                              {c.merchantName ?? "—"} · {c.atCampaignId ?? c.externalId}
                            </div>
                          </div>
                          <StatusPill tone={CAMPAIGN_STATUS_META[c.status].tone} dot>
                            {CAMPAIGN_STATUS_META[c.status].label}
                          </StatusPill>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CrawlProgressView({ progress }: { progress: CrawlerProgress }): React.ReactElement {
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;
  const elapsedMs =
    progress.startedAt
      ? (progress.finishedAt ?? Date.now()) - progress.startedAt
      : 0;
  const elapsedS = Math.floor(elapsedMs / 1000);
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between text-[12px]">
          <span className="font-medium text-admin-ink">
            Đã xử lý {progress.done} / {progress.total || "?"} chiến dịch
          </span>
          <span className="font-mono text-admin-mute">{pct}% · {elapsedS}s</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-admin-subtle">
          <div
            className="h-full bg-admin-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="rounded-md border border-admin-line bg-admin-subtle/30 p-3">
        <div className="text-[10.5px] uppercase tracking-wide text-admin-mute">
          Đang xử lý
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-admin-ink">
          {progress.currentLabel ?? "—"}
        </div>
      </div>
      {progress.lastError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {progress.lastError}
        </div>
      ) : null}
      <p className="text-[11px] text-admin-mute">
        Sau khi lấy xong tất cả chiến dịch, hệ thống còn bước AI làm giàu dữ liệu + lưu vào kho
        (thanh tiến trình có thể đứng yên 1–2 phút cuối — đây là bình thường).
      </p>
    </div>
  );
}

function CrawlResultView({ result }: { result: RunSelectedCrawlerResult }): React.ReactElement {
  const fmt = (n: number): string => n.toLocaleString("vi-VN");
  const noFetch = result.fetched === 0;
  const noNew = result.created === 0 && result.updated === 0;

  let banner: { tone: "success" | "warning" | "error"; text: string };
  if (noFetch) {
    banner = {
      tone: "warning",
      text: "Không lấy được sản phẩm nào — kiểm tra lại bộ lọc hoặc trạng thái chiến dịch trên Accesstrade."
    };
  } else if (noNew) {
    banner = {
      tone: "warning",
      text: `Lấy về ${fmt(result.fetched)} sản phẩm nhưng không có thay đổi — dữ liệu trong kho đã trùng khớp.`
    };
  } else {
    banner = {
      tone: "success",
      text: `Hoàn tất — thêm mới ${fmt(result.created)}, cập nhật ${fmt(result.updated)} sản phẩm.`
    };
  }

  const bannerClass =
    banner.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className="space-y-4 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-[13px] ${bannerClass}`}>{banner.text}</div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Lấy về" value={fmt(result.fetched)} />
        <StatTile label="Qua bộ lọc" value={fmt(result.passedFilter)} tone="info" />
        <StatTile label="Thêm mới" value={fmt(result.created)} tone="success" />
        <StatTile label="Cập nhật" value={fmt(result.updated)} tone="muted" />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-admin-ink">Chi tiết theo chiến dịch</p>
        <div className="max-h-64 overflow-auto rounded-md border border-admin-line">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-admin-subtle/70 text-[11px] uppercase tracking-wide text-admin-mute">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Chiến dịch</th>
                <th className="px-3 py-2 text-right font-medium">Lấy về</th>
                <th className="px-3 py-2 text-right font-medium">Hợp lệ</th>
                <th className="px-3 py-2 text-right font-medium">Bỏ qua</th>
              </tr>
            </thead>
            <tbody>
              {result.campaigns.map((c) => {
                const zero = c.fetched === 0;
                return (
                  <tr key={c.campaignId} className="border-t border-admin-line">
                    <td className="px-3 py-2">
                      <div className="font-medium text-admin-ink">{c.campaignName}</div>
                      <div className="font-mono text-[10.5px] text-admin-mute">
                        {c.merchantSlug}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${zero ? "text-amber-600" : "text-admin-ink"}`}>
                      {fmt(c.fetched)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-ink">
                      {fmt(c.routed)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-mute">
                      {fmt(c.failedFilter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-admin-mute">
          <span className="font-semibold">Lấy về</span> = số offer Accesstrade trả về ·{" "}
          <span className="font-semibold">Hợp lệ</span> = qua bộ lọc, được nạp ·{" "}
          <span className="font-semibold">Bỏ qua</span> = không khớp bộ lọc.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "info" | "success" | "muted";
}): React.ReactElement {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "info"
        ? "text-admin-accent"
        : tone === "muted"
          ? "text-admin-mute"
          : "text-admin-ink";
  return (
    <div className="rounded-lg border border-admin-line bg-admin-subtle/30 p-2.5">
      <div className="text-[11px] font-medium text-admin-mute">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
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

function CampaignReadonlyInfo({ row }: { row: CampaignRow }): React.ReactElement {
  return (
    <div className="sm:col-span-2 -mt-1 mb-1 rounded-lg border border-admin-line bg-admin-subtle/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-admin-mute">
        Thông tin từ Accesstrade
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <KV label="Mã nội bộ" mono value={row.externalId} />
        <KV label="ID Accesstrade" mono value={row.atCampaignId ?? "—"} />
        <KV label="Phân loại AT" value={row.atCategoryName ?? "—"} />
        <KV label="Phân loại con" value={row.atSubCategory ?? "—"} />
        <KV label="Phạm vi" value={row.atScope ?? "—"} />
        <KV
          label="Cookie (giây)"
          value={row.atCookieDurationSec != null ? String(row.atCookieDurationSec) : "—"}
        />
        <KV
          label="Bắt đầu"
          value={row.atStartTime ? dateFmt.format(new Date(row.atStartTime)) : "—"}
        />
        <KV
          label="Kết thúc"
          value={row.atEndTime ? dateFmt.format(new Date(row.atEndTime)) : "—"}
        />
        <KV label="Đồng bộ gần nhất" value={relativeTime(row.atLastSyncedAt)} />
        <KV
          label="Trang cửa hàng"
          value={
            row.atMerchantUrl ? (
              <a
                href={row.atMerchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-admin-accent hover:underline"
              >
                {row.atMerchantUrl}
              </a>
            ) : (
              "—"
            )
          }
        />
        <KV
          label="Sản phẩm / Đơn"
          value={`${row._count.products} / ${row._count.conversions}`}
        />
        <KV
          label="Bộ lọc đang dùng"
          value={
            row.filterRules
              ? summarizeFilterRules(row.filterRules as never)
              : "Mặc định (chưa cấu hình)"
          }
        />
      </div>
    </div>
  );
}

function CampaignFields({ editing }: { editing?: boolean }): React.ReactElement {
  return (
    <>
      <ControlledSelectField<CampaignCreateInput>
        name="network"
        label="Mạng affiliate"
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
        label="Tên cửa hàng (merchant)"
        placeholder="Shopee"
      />
      <ControlledTextField<CampaignCreateInput>
        name="commissionNote"
        label="Ghi chú hoa hồng"
        placeholder="2–8% theo ngành hàng, cookie 1 ngày"
      />
      {editing ? (
        <>
          <ControlledDateField<CampaignUpdateInput> name="appliedAt" label="Ngày apply" />
          <ControlledDateField<CampaignUpdateInput> name="approvedAt" label="Ngày duyệt" />
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

// ===== Filter rules form =====

interface FilterRulesFormState {
  minDiscountPercent: string;
  maxDiscountPercent: string;
  priceMin: string;
  priceMax: string;
  salePriceMin: string;
  salePriceMax: string;
  discountAmountMin: string;
  discountAmountMax: string;
  updateLookbackDays: string;
  statusDiscount: "" | "0" | "1";
  domainsText: string;
}

const EMPTY_FILTER_RULES_FORM: FilterRulesFormState = {
  minDiscountPercent: "",
  maxDiscountPercent: "",
  priceMin: "",
  priceMax: "",
  salePriceMin: "",
  salePriceMax: "",
  discountAmountMin: "",
  discountAmountMax: "",
  updateLookbackDays: "",
  statusDiscount: "",
  domainsText: ""
};

function toFilterRulesFormState(raw: Record<string, unknown> | null): FilterRulesFormState {
  if (!raw) return EMPTY_FILTER_RULES_FORM;
  const r = raw as Partial<FilterRules>;
  const numStr = (v: number | undefined): string =>
    typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  return {
    minDiscountPercent: numStr(r.minDiscountPercent),
    maxDiscountPercent: numStr(r.maxDiscountPercent),
    priceMin: numStr(r.priceMin),
    priceMax: numStr(r.priceMax),
    salePriceMin: numStr(r.salePriceMin),
    salePriceMax: numStr(r.salePriceMax),
    discountAmountMin: numStr(r.discountAmountMin),
    discountAmountMax: numStr(r.discountAmountMax),
    updateLookbackDays: numStr(r.updateLookbackDays),
    statusDiscount:
      r.status_discount === 0 ? "0" : r.status_discount === 1 ? "1" : "",
    domainsText: Array.isArray(r.domains) ? r.domains.join(", ") : ""
  };
}

function parseFilterRulesForm(
  form: FilterRulesFormState
): { ok: true; value: FilterRules | null } | { ok: false; error: string } {
  const parseNum = (s: string): number | undefined => {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    return n;
  };
  const out: Record<string, unknown> = {};
  const minD = parseNum(form.minDiscountPercent);
  const maxD = parseNum(form.maxDiscountPercent);
  if (minD !== undefined) out.minDiscountPercent = minD;
  if (maxD !== undefined) out.maxDiscountPercent = maxD;
  const pMin = parseNum(form.priceMin);
  const pMax = parseNum(form.priceMax);
  if (pMin !== undefined) out.priceMin = pMin;
  if (pMax !== undefined) out.priceMax = pMax;
  const sMin = parseNum(form.salePriceMin);
  const sMax = parseNum(form.salePriceMax);
  if (sMin !== undefined) out.salePriceMin = sMin;
  if (sMax !== undefined) out.salePriceMax = sMax;
  const dMin = parseNum(form.discountAmountMin);
  const dMax = parseNum(form.discountAmountMax);
  if (dMin !== undefined) out.discountAmountMin = dMin;
  if (dMax !== undefined) out.discountAmountMax = dMax;
  const lookback = parseNum(form.updateLookbackDays);
  if (lookback !== undefined) out.updateLookbackDays = lookback;
  if (form.statusDiscount === "0") out.status_discount = 0;
  else if (form.statusDiscount === "1") out.status_discount = 1;
  const domains = form.domainsText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (domains.length > 0) out.domains = domains;

  if (Object.keys(out).length === 0) return { ok: true, value: null };

  const parsed = clientFilterRulesSchema.safeParse(out);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `${issue.path.join(".") || "Form"}: ${issue.message}`
    };
  }
  if (
    parsed.data.minDiscountPercent !== undefined &&
    parsed.data.maxDiscountPercent !== undefined &&
    parsed.data.minDiscountPercent > parsed.data.maxDiscountPercent
  ) {
    return { ok: false, error: "minDiscountPercent > maxDiscountPercent" };
  }
  return { ok: true, value: parsed.data };
}

function FilterRulesForm({
  value,
  onChange,
  error,
  disabled
}: {
  value: FilterRulesFormState;
  onChange: (next: FilterRulesFormState) => void;
  error: string | null;
  disabled?: boolean;
}): React.ReactElement {
  const set = <K extends keyof FilterRulesFormState>(
    key: K,
    v: FilterRulesFormState[K]
  ): void => {
    onChange({ ...value, [key]: v });
  };
  return (
    <div className="space-y-4 text-sm">
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error}
        </div>
      ) : null}
      <FRSection title="Discount %" hint="0–100, push xuống AT discount_rate_from/to">
        <FRInput
          label="Min %"
          value={value.minDiscountPercent}
          onChange={(v) => set("minDiscountPercent", v)}
          disabled={disabled}
          placeholder="0"
        />
        <FRInput
          label="Max %"
          value={value.maxDiscountPercent}
          onChange={(v) => set("maxDiscountPercent", v)}
          disabled={disabled}
          placeholder="100"
        />
      </FRSection>
      <FRSection title="Giá gốc (VND)" hint="AT price_from/to">
        <FRInput
          label="Min"
          value={value.priceMin}
          onChange={(v) => set("priceMin", v)}
          disabled={disabled}
          placeholder="0"
        />
        <FRInput
          label="Max"
          value={value.priceMax}
          onChange={(v) => set("priceMax", v)}
          disabled={disabled}
          placeholder="∞"
        />
      </FRSection>
      <FRSection title="Giá sau giảm (VND)" hint="AT discount_from/to">
        <FRInput
          label="Min"
          value={value.salePriceMin}
          onChange={(v) => set("salePriceMin", v)}
          disabled={disabled}
        />
        <FRInput
          label="Max"
          value={value.salePriceMax}
          onChange={(v) => set("salePriceMax", v)}
          disabled={disabled}
        />
      </FRSection>
      <FRSection title="Số tiền giảm tuyệt đối (VND)" hint="AT discount_amount_from/to">
        <FRInput
          label="Min"
          value={value.discountAmountMin}
          onChange={(v) => set("discountAmountMin", v)}
          disabled={disabled}
        />
        <FRInput
          label="Max"
          value={value.discountAmountMax}
          onChange={(v) => set("discountAmountMax", v)}
          disabled={disabled}
        />
      </FRSection>
      <FRSection
        title="Incremental sync"
        hint="Chỉ pull offer có update_time trong N ngày qua (1–365)"
      >
        <FRInput
          label="N ngày"
          value={value.updateLookbackDays}
          onChange={(v) => set("updateLookbackDays", v)}
          disabled={disabled}
          placeholder="vd 7"
        />
      </FRSection>
      <FRSection title="Discount status" hint="AT status_discount: 0/1/bỏ trống">
        <div className="col-span-2 flex flex-wrap gap-2">
          {[
            { v: "", label: "Bỏ trống (cả 2)" },
            { v: "1", label: "Có discount (1)" },
            { v: "0", label: "Không discount (0)" }
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              disabled={disabled}
              onClick={() => set("statusDiscount", opt.v as "" | "0" | "1")}
              className={
                "rounded-md border px-2.5 py-1 text-[12px] transition " +
                (value.statusDiscount === opt.v
                  ? "border-admin-accent bg-admin-accent-soft text-admin-accent-ink"
                  : "border-admin-line text-admin-mute hover:border-admin-accent")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FRSection>
      <FRSection
        title="Domains"
        hint="Phẩy ngăn cách. AT chỉ push xuống khi đúng 1 domain — nhiều domain → filter client-side"
      >
        <div className="col-span-2">
          <input
            type="text"
            disabled={disabled}
            value={value.domainsText}
            onChange={(e) => set("domainsText", e.target.value)}
            placeholder="shopee.vn, lazada.vn"
            className="h-9 w-full rounded-md border border-admin-line bg-admin-surface px-2 text-sm text-admin-ink"
          />
        </div>
      </FRSection>
    </div>
  );
}

function FRSection({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
      <div>
        <div className="text-[12.5px] font-semibold text-admin-ink">{title}</div>
        {hint ? <div className="text-[10.5px] text-admin-mute">{hint}</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function FRInput({
  label,
  value,
  onChange,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wide text-admin-mute">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-md border border-admin-line bg-admin-surface px-2 text-sm text-admin-ink"
      />
    </label>
  );
}
